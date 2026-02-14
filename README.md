# Makasha Sim (React + Vite)

트릭컬 리바이브 캐릭터를 소재로 만든 팬메이드 클리커 게임입니다.

> 이 저장소는 `shukketsz9-lab/makasha-sim` 원본을 포크한 뒤,
> React + Vite 구조와 UX/성능/유지보수성을 중심으로 개선한 버전입니다.

## Preview
- React 개선판 (this repo): `https://iniru.github.io/makasha-sim/`
- 원본 버전: `https://shukketsz9-lab.github.io/makasha-sim/`

## Upstream / Credits
- Original repository: `https://github.com/shukketsz9-lab/makasha-sim`
- Fork & React improvement: `https://github.com/INIRU/makasha-sim`
- 원본 제작/아이디어 크레딧은 upstream 작성자에게 있습니다.

## Features
- React 기반 게임 UI/상태 관리
- `localStorage` 자동 저장/복구
- 설정 패널
  - 효과음 볼륨/음소거
  - 클릭 이펙트 모드(WebGL / 끔)
  - 진행상황 초기화 모달
- 후반 진행 보강
  - 집중 게이지
  - 각성 모드(액티브)

## Local Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## GitHub Pages 배포

이 프로젝트는 GitHub Actions로 `dist`를 자동 배포합니다.

### 1) 저장소 설정
GitHub 저장소에서 아래를 확인하세요.
- `Settings` -> `Pages`
- `Source`: **GitHub Actions**

### 2) 자동 배포 트리거
- `main` 또는 `master` 브랜치에 push 시 자동 배포
- 수동 배포는 Actions 탭에서 `Deploy to GitHub Pages` 실행

워크플로 파일:
- `.github/workflows/deploy-pages.yml`

### 3) Vite base 경로 처리 방식
`vite.config.js`에서 배포 환경을 보고 자동으로 base를 결정합니다.
- 로컬 개발/일반 빌드: `/`
- GitHub Actions + 프로젝트 페이지: `/<repo>/`
- 필요시 `VITE_BASE_PATH` 환경변수로 강제 지정 가능

## 프로젝트 구조
```text
.
├── .github/workflows/deploy-pages.yml   # Pages CI/CD
├── public/resources/                    # GIF/MP3 정적 리소스
├── src/
│   ├── App.jsx                          # 메인 화면/이벤트 핸들러
│   ├── gameData.js                      # 밸런스 상수/리소스 경로
│   ├── gameLogic.js                     # 점수/업그레이드/틱 계산
│   ├── storage.js                       # localStorage 로드/저장/정규화
│   ├── useGameAudio.js                  # Web Audio 기반 사운드 재생
│   ├── WebGLFallingLayer.jsx            # THREE + GSAP 클릭 이펙트
│   ├── ResetConfirmModal.jsx            # 진행 초기화 확인 모달
│   └── styles.css                       # 전체 스타일
└── vite.config.js                       # Vite 빌드 설정(base 포함)
```

## 처음 수정하는 사람용 가이드

### UI 텍스트/버튼 위치 바꾸기
- `src/App.jsx`

### 색상/간격/폰트 바꾸기
- `src/styles.css`

### 게임 밸런스(비용, 배율, 해금 레벨) 바꾸기
- `src/gameData.js`
- `src/gameLogic.js`

### 저장 데이터 포맷 바꾸기
- `src/storage.js`

### 사운드 체감(동시 재생, 간격, 볼륨 처리) 바꾸기
- `src/useGameAudio.js`

### 클릭 이펙트(WebGL) 성능/연출 바꾸기
- `src/WebGLFallingLayer.jsx`

## Trouble Shooting

### GitHub Pages에서 흰 화면이 나와요
- `Settings -> Pages -> Source`가 `GitHub Actions`인지 확인
- Actions 탭에서 `Deploy to GitHub Pages` 성공 여부 확인
- 브라우저 강력 새로고침(`Cmd+Shift+R` / `Ctrl+F5`)

### 연타 시 버벅여요
- 설정 패널에서 클릭 이펙트를 `끔(저사양)`으로 변경
- 효과음 볼륨을 낮추거나 음소거로 테스트

## License / Notice
본 프로젝트는 팬메이드 콘텐츠입니다.
사용 리소스의 저작권은 원저작권자(에피드게임즈)에 있습니다.
