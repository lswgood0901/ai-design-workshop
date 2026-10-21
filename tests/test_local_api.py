"""Protocol checks with a fake pipeline; model weights and GPU are not required."""
import base64
import importlib.util
import io
from pathlib import Path
import threading
import sys
import time
import unittest

from fastapi.testclient import TestClient
from PIL import Image

spec = importlib.util.spec_from_file_location("local_api", Path(__file__).parents[1] / "scripts/local_api.py")
api = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = api
spec.loader.exec_module(api)
AUTH = {"Authorization": "Bearer local"}


def reference():
    buffer = io.BytesIO()
    Image.new("RGB", (128, 64), "red").save(buffer, "PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


class FakeEngine:
    def __init__(self):
        self.calls = []
        self.started = threading.Event()
        self.release = None
        self.fail = False

    def invoke(self, body, images, seed, width, height):
        self.calls.append((len(images), seed, width, height))
        self.started.set()
        if self.release:
            self.release.wait(5)
        if self.fail:
            raise RuntimeError("fake failure")
        return Image.new("RGB", (width, height), "blue")


class LocalApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = FakeEngine()
        self.client = TestClient(api.create_app(lambda: self.engine), base_url="http://127.0.0.1")
        self.client.__enter__()
        for _ in range(100):
            if self.client.get("/health").json()["ready_workers"]:
                break
            time.sleep(.01)
        else:
            self.fail("fake engine did not load")

    def tearDown(self):
        if self.engine.release:
            self.engine.release.set()
        self.client.__exit__(None, None, None)

    def post(self, route="generate", **values):
        return self.client.post("/v1/" + route, json={"prompt": "wooden table", **values}, headers=AUTH)

    def test_generate_webp_seed_and_size(self):
        r = self.post(width=512, height=512, seed=42)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["content-type"], "image/webp")
        self.assertEqual(r.headers["x-seed"], "42")
        self.assertEqual(Image.open(io.BytesIO(r.content)).size, (512, 512))
        self.assertEqual(self.engine.calls, [(0, 42, 512, 512)])

    def test_edit_dimensions_follow_reference(self):
        r = self.post("edit", input_image=reference(), seed=3)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.engine.calls[-1], (1, 3, 128, 64))
        self.assertEqual(self.post("edit", image=[reference()]).status_code, 200)

    def test_request_contract_rejects_invalid_inputs(self):
        for values in [{"mask": "abc"}, {"prompt": " "}, {"seed": True},
                       {"width": 513}, {"width": 2048, "height": 2048},
                       {"num_images_per_prompt": 2}, {"output_format": "png"},
                       {"input_image": reference()}]:
            with self.subTest(values=list(values)):
                self.assertEqual(self.post(**values).status_code, 422)
        self.assertEqual(self.post("edit").status_code, 422)
        self.assertEqual(self.post("edit", image=[reference()] * 5).status_code, 422)
        self.assertEqual(self.post("edit", image=reference(), input_image=reference()).status_code, 422)
        self.assertEqual(len(self.engine.calls), 0)

    def test_invalid_image_and_media_type(self):
        for image in ["https://example.com/image.png", "not base64", "data:image/png;base64,YWJj",
                      reference().replace("image/png", "image/webp")]:
            self.assertEqual(self.post("edit", input_image=image).status_code, 422)
        self.assertEqual(self.post("edit", input_image="A" * (api.MAX_IMAGE * 2)).status_code, 413)
        self.assertEqual(len(self.engine.calls), 0)

    def test_body_limit_before_json_parsing(self):
        r = self.client.post("/v1/generate", content=b"{}", headers={**AUTH, "Content-Length": str(api.MAX_BODY + 1)})
        self.assertEqual(r.status_code, 413)

    def test_local_auth_and_host(self):
        self.assertEqual(self.client.post("/v1/generate", json={"prompt": "table"}).status_code, 401)
        self.assertEqual(self.client.get("/health", headers={"Host": "external.example"}).status_code, 400)
        self.assertEqual(self.client.get("/v1/status", headers=AUTH).json()["ready_workers"], 1)

    def test_cors_local_only(self):
        for origin, status in [("http://127.0.0.1:8000", 200), ("https://external.example", 400)]:
            r = self.client.options("/v1/generate", headers={"Origin": origin,
                "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
            self.assertEqual(r.status_code, status)

    def test_busy_rejects_before_second_inference(self):
        self.engine.release = threading.Event()
        responses = []
        thread = threading.Thread(target=lambda: responses.append(self.post(width=64, height=64)))
        thread.start()
        self.assertTrue(self.engine.started.wait(2))
        r = self.post(width=64, height=64)
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.headers["retry-after"], "3")
        self.assertEqual(self.client.get("/v1/status", headers=AUTH).json()["workers"][0]["state"], "busy")
        self.engine.release.set()
        thread.join(2)
        self.assertFalse(thread.is_alive())
        self.assertEqual(responses[0].status_code, 200)
        self.assertEqual(len(self.engine.calls), 1)

    def test_error_releases_slot(self):
        self.engine.fail = True
        self.assertEqual(self.post(width=64, height=64).status_code, 503)
        self.engine.fail = False
        self.assertEqual(self.post(width=64, height=64).status_code, 200)

    def test_schema_exposes_generate_edit(self):
        schema = self.client.get("/v1/schema", headers=AUTH).json()
        self.assertIn("/v1/generate", schema["paths"])
        self.assertIn("/v1/edit", schema["paths"])

    def test_low_memory_detail_reaches_browser_and_releases_slot(self):
        original = self.engine.invoke
        def stop(*_):
            raise api.ResourceStop("사용 가능한 메모리가 4GiB 아래로 내려가 작업을 중단했습니다.")
        self.engine.invoke = stop
        response = self.post(width=512, height=512)
        self.assertEqual(response.status_code, 503)
        self.assertIn("4GiB", response.json()["detail"])
        self.engine.invoke = original
        self.assertEqual(self.post(width=512, height=512).status_code, 200)

    def test_local_default_and_size_cap(self):
        self.assertEqual(self.post().status_code, 200)
        self.assertEqual(self.engine.calls[-1][2:], (512, 512))
        self.assertEqual(self.post(width=1024, height=256).status_code, 422)


if __name__ == "__main__":
    unittest.main()
