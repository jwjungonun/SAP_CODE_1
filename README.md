# SAP CODE ACADEMY 1기 CYCLONE_ERP

## 📌 프로젝트 개요
### 자전거 제조와 유통의 흐름을 하나로 연결하는 SAP S/4HANA ERP 통합 프로세스
자전거 제조 기업 CYCLONE의 주문·생산 정보 분산, 재고 가시성 부족, 부서 간 연계 미흡, 수익성 분석의 한계를 해결하기 위해 SAP S/4HANA 기반의 ERP 시스템을 구현하였습니다.<br>
SD, MM, PP, FI/CO, QM 모듈을 하나의 흐름으로 연결하여 주문부터 생산, 조달, 출하, 청구까지 이어지는 MTS/MTO 시나리오 기반의 End-to-End 프로세스를 설계 및 개발하였습니다.<br>
주요 기능은 관리회계 전표 조회, CO 마스터 관리, 수익성 분석, 배부 조회, 활동단가 산출, 손익센터 관리, 표준제조원가 릴리즈 등이 있습니다.
<hr>

## 👨🏻‍💻 팀 구성 및 역할 분담
#### 한영환: PM, QM
#### 정유리: 부PM, MM
#### 이재민: PL, FI
#### 심재익: SD
#### 임선희: PP
#### 윤채리: PP
#### 정원준: CO
#### 박소영: MM


## 🛠️ 기술 스택
#### SAP Platform

<img src="https://img.shields.io/badge/SAP_S%2F4HANA-0FAAFF?style=for-the-badge&logo=sap&logoColor=white"/> <img src="https://img.shields.io/badge/SAP_GUI-0FAAFF?style=for-the-badge&logo=sap&logoColor=white"/><br>


#### SAP Module

<img src="https://img.shields.io/badge/SD-F0AB00?style=for-the-badge&logoColor=white"/> <img src="https://img.shields.io/badge/MM-F0AB00?style=for-the-badge&logoColor=white"/> <img src="https://img.shields.io/badge/PP-F0AB00?style=for-the-badge&logoColor=white"/> <img src="https://img.shields.io/badge/FI-F0AB00?style=for-the-badge&logoColor=white"/> <img src="https://img.shields.io/badge/CO-F0AB00?style=for-the-badge&logoColor=white"/> <img src="https://img.shields.io/badge/QM-F0AB00?style=for-the-badge&logoColor=white"/><br>


#### Development

<img src="https://img.shields.io/badge/ABAP-1F6FEB?style=for-the-badge&logo=sap&logoColor=white"/> <img src="https://img.shields.io/badge/CDS_View-1F6FEB?style=for-the-badge&logo=sap&logoColor=white"/> <img src="https://img.shields.io/badge/RAP-1F6FEB?style=for-the-badge&logo=sap&logoColor=white"/> <img src="https://img.shields.io/badge/OData-1F6FEB?style=for-the-badge&logo=odata&logoColor=white"/><br>


#### UI

<img src="https://img.shields.io/badge/SAP_Fiori-0A6ED1?style=for-the-badge&logo=sap&logoColor=white"/> <img src="https://img.shields.io/badge/SAPUI5-0A6ED1?style=for-the-badge&logo=sap&logoColor=white"/><br>

<hr>

## Event Flow Diagram
![프로세스 흐름도](images/event_flow_diagram.png)

## ERD Diagram
![ERD](images/erd_diagram.png)


<hr>

## 🖥️ 주요 기능

### 관리회계 전표 조회 <br>

![관리회계 전표 조회 화면]([이미지 URL])<br>
- 관리회계 영역, 회계연도 등 조건별 전표 조회
- 현재 기준 지난 한 달을 전기일 기본 조회 기간으로 설정
- 조회 결과가 없을 경우 에러 메시지 팝업 출력
<br>

![관리회계 전표 조회 결과 화면]([이미지 URL])<br>
- 상단 컨테이너의 조회 조건 및 전표 항목 건수 확인
- 전표 행 더블클릭 시 전표 아이템 상세 조회
- CO 마스터 관리 및 배부 사이클 화면 이동 기능
<br>

### 관리회계 전표 확장 조회 (Fiori) <br>

![관리회계 전표 확장 조회 화면]([이미지 URL])<br>
- 전표 항목과 전표 항목 상세 구조의 전표 조회
- 코스트센터, 손익센터, 자재의 코드와 한글명 함께 표기
- 전표 항목 선택 시 전표 상세 내용 확인
<br>

![관리회계 전표 확장 조회 조건 화면]([이미지 URL])<br>
- 코스트센터, 손익센터, 원가요소 조건을 추가한 확장 조회 기능
- 확장 조회 결과를 전표 항목과 상세 영역에 함께 반영
- 조회 결과가 없을 경우 메시지 출력
<br>

### CO 마스터 테이블 관리 <br>

![CO 마스터 조회 조건 화면]([이미지 URL])<br>
- 코스트센터, 손익센터, 원가요소, 활동유형 마스터 선택 기능
- 빈 값으로 조회 시 전체 데이터 조회
- 존재하지 않는 값 입력 시 에러 처리
<br>

![CO 마스터 관리 화면]([이미지 URL])<br>
- Tabstrip 기반 마스터별 화면 전환
- 편집형 ALV Grid를 통한 데이터 생성, 수정, 삭제 기능
- 저장 시 변경 사항을 마스터 테이블에 반영
- 필드 수정을 제한하는 토글 기능
- 새로고침을 통한 최신 데이터 조회
<br>

### 손익센터 관리 (Fiori) <br>

![손익센터 관리 화면]([이미지 URL])<br>
- 손익센터 마스터 전체 목록 확인
- 손익센터 코드 및 명칭 검색 기능
- 손익센터 구분별 분포 차트 확인
- 유효시작 연도별 분포 차트 확인
<br>

![손익센터 활성화 처리 화면]([이미지 URL])<br>
- 손익센터 활성화 및 비활성화 상태 변경 기능
- 변경된 상태를 손익센터 마스터에 반영
<br>

### 수익성 분석 <br>

![수익성 분석 조회 조건 화면]([이미지 URL])<br>
- 관리회계 영역을 고정하고 회계연도, 전기 기간으로 조회
- 전기 기간의 시작월 미입력 시 에러 처리
<br>

![수익성 분석 결과 화면]([이미지 URL])<br>
- 손익센터, 거래처, 자재 계층의 Tree 구성
- 자재 노드 더블클릭 시 해당 거래처 및 자재 수익성 확인
- 거래처별 수익성 그리드와 제품군별 수익성 그리드 확인
- 거래처별 수익률 차트 시각화
- 제품군별 매출 및 수익 차트 시각화
<br>

### 수익성 분석 (Fiori) <br>

![수익성 분석 Fiori 화면]([이미지 URL])<br>
- 배부까지 반영된 수익성 데이터 조회 및 시각화
- 데이터의 최신 회계연도와 전기월을 기본값으로 조회
- 매출액, 매출원가, 매출이익, 이익률 확인
- 매출이익이 음수인 레코드의 적자 알림 목록 확인
<br>

![수익성 표 및 제품 분석 화면]([이미지 URL])<br>
- 스크롤 시에도 위치가 유지되는 조회 기간 및 항목 탭
- 항목별 분석 결과 확인
- 수익성 표 페이지 이동 기능
- 제품군 차트 클릭을 통한 제품 분석 기능
<br>

### 배부 조회 <br>

![배부 조회 화면]([이미지 URL])<br>
- 배부 사이클별 세그먼트 및 수신처 조회
- 월말 통합 공통비(ALMON1)에 포함된 세그먼트 목록 확인
- 세그먼트 행 더블클릭 시 수신처 내역 및 파이 차트 확인
- 연결된 수신처 이력이 없을 경우 에러 메시지 출력
- 수익성 분석 프로그램 이동 기능
<br>

### 활동단가 관리 <br>

![활동단가 조회 화면]([이미지 URL])<br>
- 조립작업 및 생산작업 활동유형별 활동단가 확인
- 회계연도별 활동단가 이력 조회
- 올해와 작년의 월별 활동단가 차이 확인
- 월별 활동단가 차이 차트 시각화
<br>

![활동단가 산출 화면]([이미지 URL])<br>
- 이번 해, 이번 월 기준 활동단가 산출 기능
- 급여와 부서 규모를 반영한 인원당 활동단가 계산
- 산출 결과를 활동단가 이력 테이블에 반영
<br>

### 월간 표준제조원가 릴리즈 (개발: 한영환) <br>

![월간 표준제조원가 릴리즈 화면]([이미지 URL])<br>
- 플랜트, 회계연도, 월 기준 표준원가 산정 대상 자재 조회
- 산정대기, 시뮬레이션, 릴리즈, 취소 상태별 현황 확인
- BOM 전개를 통한 투입 자재, 소요수량, 재료비 조회
- 직접재료비, 직접노무비, 제조간접비 기반 표준 제조원가 산정
<br>

![표준원가 시뮬레이션 및 릴리즈 화면]([이미지 URL])<br>
- 원가 시뮬레이션을 통한 산정 결과 사전 검토
- 표준원가 릴리즈 및 자재 마스터 표준가격 반영
- 취소사유 입력을 통한 원가산정 취소 및 재산정 기능
<br>
