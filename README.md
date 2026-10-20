# AI Design Workflow Workshop

제품디자이너가 Codex 또는 Claude Code와 함께 이미지 생성·편집용 웹 인터페이스를 만드는 실습입니다. HTML, CSS, JavaScript로 시작하며, 첫 시간에는 이미지 모델을 연결하지 않습니다.

## 시작하기

1. [계정·앱 준비](docs/accounts.md)를 확인하고, 익숙한 코딩 도구 하나로 빈 실습 폴더를 엽니다.
2. 아래 지시문을 Codex 또는 Claude Code에 붙여 넣습니다.
3. 14:30–15:15에는 인터페이스와 히스토리를 구현합니다.
4. 쉬는 시간에 **로컬 실행 참가자만** FLUX 모델을 다운로드합니다.
5. 강사의 안내 후 모델을 연결해 디자인 생성·편집을 진행합니다.

공개 자료를 읽거나 ZIP으로 받는 데 GitHub 가입은 필요하지 않습니다. Git 명령이나 환경 복제 방법을 외우는 대신, 코딩 도구에 폴더와 목표를 설명합니다.

### 첫 지시문

```text
https://github.com/lswgood0901/ai-design-workshop 의 README.md,
AGENTS.md, docs/interface-requirements.md, prompts/01-interface.md를 읽어줘.
내가 선택한 현재 폴더에서 1단계 인터페이스 실습을 진행해줘.
HTML/CSS/JavaScript로 이미지 생성·편집 화면과 히스토리를 만들어줘.
아직 이미지 모델이나 외부 API를 연결하지 말고,
내가 브라우저에서 직접 확인할 수 있게 실행해줘.
운영체제와 폴더 상태를 먼저 확인하고, 기존 파일은 보존해줘.
```

코딩 도구가 GitHub를 읽지 못하면 [Code → Download ZIP](https://github.com/lswgood0901/ai-design-workshop/archive/refs/heads/main.zip)으로 받은 폴더를 열고 같은 지시를 내립니다.

## 단계별 자료

| 단계 | 내용 | 자료 |
|---|---|---|
| 1 · 14:30–15:15 | 웹 화면, 이미지 입력, 히스토리, 마스크 | [요구사항](docs/interface-requirements.md), [첫 지시문](prompts/01-interface.md) |
| 환경 점검 | Windows NVIDIA / Mac MPS / 한양대 GPU 선택 | [로컬 환경](docs/local-setup.md) |
| 휴식 | 로컬 모델 선택 다운로드 및 검증 | [다운로드 안내](docs/model-download.md), [지시문](prompts/02-download.md) |
| 2 · 휴식 후 | 모델 연결, 생성·편집, 결과 저장 | [API 계약](docs/api.md), [연결 지시문](prompts/03-connect.md) |
| 디자인 과제 | 테이블 디자인 생성과 부위 수정 | [과제 브리프](docs/design-brief.md) |
| 3D 시연 | Meta Playground에서 이미지→3D | [시연 순서](docs/meta-playground.md) |

## 기본 웹 예제

`web/`에는 강사가 사용하는 기본 구현이 있습니다. 수업 중 처음부터 만든 화면을 유지해도 되고, 진행이 늦어지면 예제를 사용할 수 있습니다.

```bash
python scripts/serve.py
```

Windows에서는 `python` 대신 `py`를 사용할 수 있습니다. 브라우저에서 `http://127.0.0.1:8000`을 엽니다. 필요한 Python 설치와 실행은 코딩 도구에 요청해도 됩니다.

기본 예제는 처음에 모델 미연결 상태로 시작합니다. 실제 GPU 사용 시 강사에게 받은 서버 주소와 접속 키를 화면에 입력합니다. **이 저장소에는 실제 접속 키가 없습니다.**

## 실행 경로

- **한양대 GPU:** 참가자 컴퓨터에 FLUX나 CUDA를 설치하지 않습니다. 화면은 참가자 컴퓨터, 이미지 추론은 서버에서 실행합니다.
- **개인 Windows:** NVIDIA 드라이버와 해당 GPU에 맞는 PyTorch 환경을 확인합니다. CUDA Toolkit 전체 설치를 일괄 요구하지 않습니다.
- **Apple Silicon Mac:** CUDA 대신 PyTorch의 MPS/Metal 경로를 사용합니다. 메모리와 모델 구성에 따라 실행 가능 여부가 달라지며, 현장에서 문제가 생기면 서버 경로로 전환합니다.

FLUX.2-klein-4B는 생성·참조 이미지 편집 모델입니다. 객체 분할은 별도의 경량 모델을 사용합니다. 마스크를 FLUX의 공식 입력으로 보내지 않으며, 선택 영역 합성을 사용할 경우 화면에 별도로 표시합니다.

확인 기준일: 2026-10-20. 모델·앱·서비스는 변경될 수 있으므로 링크된 공식 문서와 실행 환경 점검 결과를 함께 확인합니다.
