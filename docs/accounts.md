# 실습 도구와 계정 준비

정보 기준일: **2026년 10월 20일**

아래 도구 중 기존에 구독 중인 **하나만** 사용하면 됩니다. 두 서비스를 모두 구독할 필요는 없습니다.

| 구독 | 실습 도구 | 선택할 모델 |
|---|---|---|
| ChatGPT Plus | 데스크톱 앱의 **Codex** | **GPT-6.1 Sol** |
| Claude Pro | Claude Desktop의 **Code** 탭 | **Claude Opus 5.5** |

GPT-6.1 Sol은 일반 Chat이 아닌 Codex 또는 Work에서 제공됩니다. 계정·앱별 적용 상황에 따라 모델 목록이 다를 수 있습니다. Claude Code에서 Opus 5.5를 사용하려면 최신 앱을 사용해 주세요. 두 도구 모두 기본 추론 설정으로 시작합니다.

## 수업 전에 권장하는 준비

1. 사용하는 도구의 데스크톱 앱을 설치하거나 업데이트합니다.
2. 기존 유료 구독 계정으로 로그인하고, 위 모델이 표시되는지 확인합니다.
3. 컴퓨터에 `AI-Design-Workshop` 폴더를 만듭니다.
4. Codex에서 해당 폴더를 열거나, Claude Desktop에서 **Code → Local → Open folder…**를 선택합니다.

Mac과 Windows 모두 데스크톱 앱으로 진행할 수 있습니다. Claude Desktop의 Code 탭에는 Claude Code가 포함되어 있으므로, 이를 사용하기 위한 별도 Node.js 또는 Claude CLI 설치는 필요하지 않습니다. 기본 HTML 실습에서는 WSL이나 Git 명령 사용을 요구하지 않습니다.

앱 설치와 로그인을 미리 끝내 두면 **14:30–15:15의 45분**을 인터페이스 제작에 사용할 수 있습니다. 설치 또는 계정 문제로 시작이 늦어지면, 강사가 제공하는 **기본 HTML 예제**로 이어서 진행합니다.

## 가입과 비용

- **OpenAI·Anthropic API 키 발급 및 별도 API 결제는 필요하지 않습니다.** 코딩 도구에는 구독 계정으로 로그인합니다.
- 구독에는 사용량 한도가 있습니다. 한도에 도달하면 추가 결제 없이 기본 HTML 예제로 실습을 이어갑니다.
- 한양대 GPU 서버 접속 정보는 강사가 별도로 안내합니다. 이 접속 키는 ChatGPT·Claude API 키와 다릅니다.
- 이 공개 GitHub 저장소의 문서를 읽거나 ZIP을 다운로드하는 데에는 **GitHub 가입이 필수가 아닙니다.** 자신의 저장소에 결과를 올리거나 fork하려면 계정이 필요합니다.
- 기존 개발 환경에 `ANTHROPIC_API_KEY`를 설정한 적이 있다면, Claude Code가 구독 대신 API 과금을 사용하지 않는지 확인해 주세요.

## 공식 안내

- [ChatGPT 요금제와 Codex 사용](https://learn.chatgpt.com/docs/pricing)
- [GPT-6.1 Sol 제공 범위와 모델 선택](https://learn.chatgpt.com/docs/models)
- [ChatGPT 데스크톱 앱 / Codex 시작](https://learn.chatgpt.com/docs/app)
- [Windows 데스크톱 앱](https://learn.chatgpt.com/docs/windows/windows-app)
- [Claude Pro 요금제](https://claude.com/pricing)
- [Claude Desktop의 Code 탭 시작](https://code.claude.com/docs/en/desktop-quickstart)
- [Claude Code 모델 설정](https://code.claude.com/docs/en/model-config)
- [Claude 구독 로그인과 사용량·API 과금 구분](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan)
