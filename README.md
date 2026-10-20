# AI Design Workflow Workshop

제품디자이너가 Codex 또는 Claude Code와 함께 이미지 생성·편집용 웹 인터페이스를 만드는 실습입니다. **화면 구현 → 모델 연결 → 디자인 생성·편집 → 3D 변환** 순서로 진행합니다.

## 시작하기

1. [계정·앱 준비](docs/accounts.md)를 확인하고 실습 폴더를 엽니다.
2. 아래 지시문을 Codex 또는 Claude Code에 붙여 넣습니다.
3. 14:30–15:15에는 이미지 입력, 결과 화면, 히스토리를 구현합니다.
4. 쉬는 시간에는 로컬 실행 참가자가 FLUX를 다운로드합니다.
5. GPU 서버 또는 개인 모델을 연결해 디자인을 생성·편집합니다.

```text
https://github.com/lswgood0901/ai-design-workshop 의 README.md,
AGENTS.md, docs/interface-requirements.md, prompts/01-interface.md를 읽어줘.
현재 폴더에서 1단계 인터페이스 실습을 진행해줘.
HTML/CSS/JavaScript로 이미지 생성·편집 화면과 히스토리를 만들고,
우선 실습 모드로 입력·저장 기능을 확인할 수 있게 실행해줘.
모델 연결은 다음 단계에서 진행할게.
운영체제와 폴더 상태를 확인하고 기존 파일은 보존해줘.
```

자료는 GitHub에서 읽거나 [ZIP으로 다운로드](https://github.com/lswgood0901/ai-design-workshop/archive/refs/heads/main.zip)할 수 있습니다. ZIP을 받은 경우 해당 폴더를 코딩 도구에서 엽니다.

## 실습 자료

| 단계 | 내용 | 자료 |
|---|---|---|
| 1 · 14:30–15:15 | 웹 화면, 이미지 입력, 히스토리 | [요구사항](docs/interface-requirements.md), [지시문](prompts/01-interface.md) |
| 환경 점검 | Windows NVIDIA / Mac MPS / GPU 서버 | [설치·실행 안내](docs/local-setup.md) |
| 휴식 | 로컬 모델 다운로드·검증 | [다운로드 안내](docs/model-download.md), [지시문](prompts/02-download.md) |
| 2 · 휴식 후 | 모델 연결, 생성·편집, 결과 저장 | [API](docs/api.md), [연결 지시문](prompts/03-connect.md) |
| 디자인 과제 | 테이블 디자인과 부위 수정 | [브리프·프롬프트 예시](docs/design-brief.md) |
| 선택 실습 | 클릭·브러시 영역 선택과 합성 | [영역 선택](docs/segmentation.md) |
| 3D 시연 | Meta Playground 이미지→3D | [Meta Playground](docs/meta-playground.md) |

## 기본 웹 예제 실행

프로젝트 폴더에서 다음 명령을 실행하고 `http://127.0.0.1:8000`을 엽니다. Windows는 `python` 대신 `py`, Mac은 `python3`도 사용할 수 있습니다.

```bash
python scripts/serve.py
```

기본 예제는 인터페이스 실습 모드로 시작합니다. 이미지 생성 단계에서 **GPU 서버 모드**를 선택하고 강사가 제공한 주소·접속 키를 화면에 입력합니다.

- **GPU 서버:** 브라우저에서 작업하고 서버에서 이미지를 생성합니다.
- **Windows 로컬:** NVIDIA 드라이버와 CUDA 지원 PyTorch를 사용합니다.
- **Apple Silicon Mac 로컬:** arm64 Python과 PyTorch MPS를 사용합니다.

생성은 텍스트로 시작하고, 편집은 **원본 이미지 + 수정 지시문**을 사용합니다. 수업에서는 영어 프롬프트로 정리해 사용하는 것을 권장하며, [번역 지시문](docs/design-brief.md#프롬프트를-영어로-정리하기)을 제공합니다.

확인 기준일: 2026-10-20.
