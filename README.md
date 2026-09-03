# alcanthia_fan

Alcanthia 비공식 팬페이지 프론트엔드 (빌드 없는 정적 사이트).
`alcanthia_worker` 프록시를 통해 텃밭·거래소·거주민·랭킹을 보여준다.

## 구성
```
index.html          홈페이지 진입점
css/style.css       스타일
js/config.js        프록시 주소 설정 (PROXY_BASE)
js/api.js           프록시 호출 래퍼
js/garden.js        텃밭 12×12 렌더러 (식물 스프라이트는 게임 CDN 직접 로드)
js/market.js        시세 + 호가창 + 캔들차트(canvas)
js/app.js           탭/라우팅
data/names.json     한글 이름 맵 (작물/아이템/스킬/존) — gamedata에서 생성됨
scripts/             검색 가능한 정적 도감 페이지 생성기
plants/ 등           생성된 정적 도감 HTML
garden/, calc/ 등    실제 경로로 접근하는 생성된 앱 진입 HTML
sitemap.xml          홈페이지·정적 도감·공개 공략 도구의 색인 URL 사이트맵
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
- 우상단 `연결 설정`을 클릭하면 현재 프록시 주소를 확인하고 바꿀 수 있음(배포 주소로).
- 기본값은 `http://localhost:8000` (js/config.js / localStorage).

## 배포 (GitHub Pages)
1. 이 폴더를 레포 루트로 push
2. Settings → Pages → Branch: main / root
3. 프록시(`alcanthia_worker`)는 공개 주소로 배포하고, 그 주소를 우상단 proxy 에 설정
4. 프록시의 `.env` `ALLOWED_ORIGIN` 을 팬페이지 도메인으로 (CORS)

## 데이터
이름/스킨/모험가/스킬/존/폴더색인은 `data/names.json`, 게임 데이터는 `data/gamedata.json` 에 들어있음.
로컬 갱신 도구 `regen_names.py` 는 최신 게임 번들에서 이름 색인, 아이템·스킬·의뢰·진행 목표와 `item_values` / `item_output_values` / `sell_price` 가치표를 갱신함.
이미지는 런타임에 CDN(`game.alcanthia.com/assets`)에서 직접 로드하며, `itemFolders` 색인으로 폴더를 찾음.

### 정적 도감 생성 및 검증

`data/gamedata.json`, `data/names.json` 또는 홈페이지 셸을 갱신한 뒤에는 검색 가능한 정적 도감, 실제 경로 앱 진입 페이지와 사이트맵도 반드시 다시 생성한다.

```bash
node scripts/generate-seo-pages.mjs
node scripts/generate-seo-pages.mjs --check
node --test tests/*.test.mjs
```

생성된 페이지를 포함한 로컬 미리보기:

```bash
python3 -m http.server 5500
```

브라우저에서 `http://localhost:5500/` 및 `/plants/`, `/calc/time/`, `/quests/`, `/planner/` 같은 실제 경로를 확인한다. `--check`는 커밋된 생성물이 현재 JSON 및 홈페이지 셸과 다르면 파일을 쓰지 않고 실패한다. 예전 `#calc/time` 형식 링크는 대응하는 실제 경로로 자동 이동한다. `/calc/brew/`와 `/quests/daily/`에 해당하는 기본 화면은 중복 색인을 막기 위해 각각 `/calc/`, `/quests/`를 대표 주소로 사용한다.

## 참고
- 이미지는 전부 **CDN 직접 로드**. `data/names.json` 의 `itemFolders` 색인으로 정확한 폴더 1곳을 시도(없으면 전 폴더 폴백).
- 식물 스프라이트는 스킨(`skinId`/`defaultPlantSkins`) 반영, 설치물은 `variantId` 반영.
- 비공식 팬 제작물. 운영진이 이 데이터 접근 방식을 막지 않음을 확인한 전제.
