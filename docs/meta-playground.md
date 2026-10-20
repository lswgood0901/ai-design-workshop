# Meta Playground · 이미지 기반 3D 시연

[Meta 공식 Image-to-3D Playground 열기](https://aidemos.meta.com/segment-anything/editor/convert-image-to-3d)

1. 최종 디자인 이미지를 업로드합니다.
2. 변환할 객체를 클릭합니다.
3. Add / Remove로 선택 영역을 정리합니다.
4. Generate 3D를 실행합니다.
5. 결과를 회전하며 뒷면, 다리 연결, 바닥 접촉, 비례를 확인합니다.
6. 다운로드 메뉴에서 현재 제공하는 형식을 확인하고 저장합니다.

이 실습은 제조용 CAD보다 장면 배치·형태 검토용 3D 에셋을 만드는 데 초점을 둡니다. 가려진 면과 연결부는 모델이 추정하므로 결과를 직접 확인해야 합니다.

GLB는 메시를 포함하는 3D 장면·에셋 형식입니다. PLY는 서비스에 따라 메시, 점군 또는 Gaussian 정보를 담을 수 있으므로 같은 확장자라도 다른 도구에서의 지원이 다를 수 있습니다. 실제 다운로드 메뉴에 표시되는 형식과 내용을 기준으로 저장합니다.

Playground의 접속·로그인·사용 한도와 다운로드 메뉴는 서비스 상황에 따라 달라질 수 있습니다. 현장에서는 강사 시연을 기준으로 진행합니다.

SAM 3D Objects는 [공식 GitHub](https://github.com/facebookresearch/sam-3d-objects)와 [Hugging Face](https://huggingface.co/facebook/sam-3d-objects)에도 공개되어 있습니다. 모델 사용 조건은 해당 저장소에서 확인합니다. 이번 수업에서는 로컬 3D 모델 설치를 진행하지 않습니다.
