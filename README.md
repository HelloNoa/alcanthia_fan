# alcanthia_fan

Alcanthia 비공식 팬페이지 프론트엔드 (빌드 없는 정적 사이트).
`alcanthia_worker` 프록시를 통해 텃밭·거래소·거주민·랭킹을 보여준다.

## 구성
```
index.html          진입점
css/style.css       스타일
js/config.js        프록시 주소 설정 (PROXY_BASE)
js/api.js           프록시 호출 래퍼
js/garden.js        텃밭 12×12 렌더러 (식물 스프라이트는 게임 CDN 직접 로드)
js/market.js        시세 + 호가창 + 캔들차트(canvas)
js/app.js           탭/라우팅
data/names.json     한글 이름 맵 (작물/아이템/스킬/존) — gamedata에서 생성됨
```

## 기능
- 🌱 **텃밭**: 닉네임 검색 → 12×12 텃밭 시각화(식물·강화·상태·스킬레벨)
- 💹 **거래소**: 아이템별 시세 / 매수·매도 호가창 / 캔들 차트
- 🗺️ **거주민**: 존별 공개 플레이어 목록 → 텃밭 바로보기
- 🏆 **랭킹**: 전역 랭킹 표

## 로컬 실행
ES 모듈이라 `file://` 로는 안 되고 정적 서버가 필요함.
```bash
# 1) 프록시(alcanthia_worker) 먼저 띄우기 → http://localhost:8000
# 2) 이 폴더에서 정적 서버
cd alcanthia_fan
python3 -m http.server 5500
# 브라우저: http://localhost:5500
```
- 우상단 `proxy:` 를 클릭하면 프록시 주소를 바꿀 수 있음(배포 주소로).
- 기본값은 `http://localhost:8000` (js/config.js / localStorage).

## 배포 (GitHub Pages)
1. 이 폴더를 레포 루트로 push
2. Settings → Pages → Branch: main / root
3. 프록시(`alcanthia_worker`)는 공개 주소로 배포하고, 그 주소를 우상단 proxy 에 설정
4. 프록시의 `.env` `ALLOWED_ORIGIN` 을 팬페이지 도메인으로 (CORS)

## 데이터
이름/스킨/모험가/스킬/존/폴더색인은 `data/names.json`, 게임 데이터는 `data/gamedata.json` 에 들어있음.
이미지는 런타임에 CDN(`game.alcanthia.com/assets`)에서 직접 로드하며, `itemFolders` 색인으로 폴더를 찾음.

## 참고
- 이미지는 전부 **CDN 직접 로드**. `data/names.json` 의 `itemFolders` 색인으로 정확한 폴더 1곳을 시도(없으면 전 폴더 폴백).
- 식물 스프라이트는 스킨(`skinId`/`defaultPlantSkins`) 반영, 설치물은 `variantId` 반영.
- 비공식 팬 제작물. 운영진이 이 데이터 접근 방식을 막지 않음을 확인한 전제.
