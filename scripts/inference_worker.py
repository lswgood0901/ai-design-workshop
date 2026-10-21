"""One request per process so all model allocations are released on exit."""
import json
import os
import sys
from pathlib import Path


def main():
    job_path = Path(sys.argv[1])
    job = json.loads(job_path.read_text(encoding='utf-8'))
    try:
        if os.name == 'posix':
            os.nice(10)
        from PIL import Image
        output = job_path.parent / 'result.webp'
        if job['backend'] == 'mlx':
            from infer_mlx import run
        else:
            from infer_cuda import run
        run(job, Path(job['model_dir']), output)
        with Image.open(output) as image:
            if image.size != (job['width'], job['height']):
                raise RuntimeError('Unexpected image dimensions')
            image.convert('RGB').save(output, 'WEBP', quality=95)
    except Exception as error:
        (job_path.parent / 'error.json').write_text(json.dumps({'detail': str(error)}, ensure_ascii=False), encoding='utf-8')
        raise


if __name__ == '__main__':
    main()
