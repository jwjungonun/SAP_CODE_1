sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/format/NumberFormat",
    "sap/m/MessageBox"
], (Controller, JSONModel, NumberFormat, MessageBox) => {
    "use strict";

    // ====== 가역 설정 (한 곳에서 수정) ======
    // 분석 축 정의: 축 추가/삭제/순서는 이 배열만 수정하면 됨
    const AXES = [
        { key: "prctr",   field: "Prctr",      text: "Ptext",     label: "손익센터", scoped: true  },
        { key: "matnr",   field: "Matnr",      text: "Maktx",     label: "제품"                     },
        { key: "partner", field: "Partner_no", text: "Comp_name", label: "거래처"                   },
        { key: "matkl",   field: "Matkl",      text: "Wgbez",     label: "제품군"                   }, // WGBEZ(제품군명) CDS 추가됨
        { key: "segment", field: "Segment",    text: "Segment",   label: "세그먼트"                 }  // 세그먼트명 CDS 미포함 → 코드 표시
    ];

    // 손익센터 범위: 기본 제품 손익센터(PCP_)만 노출. PCA_ 포함 시 'PCA_' 추가, 전체 노출 시 [] 로.
    const PC_SCOPE = ["PCP_"];

    const TOP_N = 8; // 차트 상위 표시 개수

    const SELECT = "Kokrs,Gjahr,Perio,Prctr,Ptext,Matnr,Maktx,Partner_no,Comp_name," +
                   "Werks,Name1,Matkl,Wgbez,Vv010,Vv020,Vv030,Waers,Segment,Profit_rate";

    return Controller.extend("zpe1coeval.zpe1coeval.controller.ZPE1_CO_EVAL", {

        onInit() {
            // 바인딩 에러 방지용 스켈레톤
            const oSkeleton = { meta: { busy: true, periodText: "", count: 0, selectedTab: "prctr", years: [], months: [], yearSel: "", monthSel: "", ptAxes: [], dims: {}, dimSel: { prctr: "all", matnr: "all", partner: "all", matkl: "all", segment: "all" }, productPage: { active: false, matklName: "" }, lossCount: 0 }, kpi: this._emptyKpi(), axes: {}, axesList: [], lossLog: [] };
            AXES.forEach(a => { oSkeleton.axes[a.key] = { key: a.key, label: a.label, count: 0, members: [], top3: [], chartProfit: [], chartSales: [], chartCost: [], chartRate: [], chartMix: [] }; });
            oSkeleton.axesList = AXES.map(a => oSkeleton.axes[a.key]);
            this.getOwnerComponent().setModel(new JSONModel(oSkeleton), "view");
            this._loadData();
        },

        // 수익성 조회: 선택 축의 테이블 페이지로 이동 (전체 상태면 토스트 안내 후 이동 안 함)
        onOpenProfitTable() {
            const oView = this.getView().getModel("view");
            // 제품 페이지(제품군 → 제품 드릴다운)에서는 selectedTab이 "matkl"로 유지되므로,
            // productPage가 활성이면 제품 축(_product)을 넘겨 제품 테이블을 연다.
            const bProd = !!(oView && oView.getProperty("/meta/productPage/active"));
            const sKey = bProd ? "_product" : ((oView && oView.getProperty("/meta/selectedTab")) || "prctr");
            if (sKey === "all") {
                MessageBox.error("항목을 선택하고 수익성 조회");
                return;
            }
            this.getOwnerComponent().getRouter().navTo("RouteProfitTable", { axis: sKey });
        },

        onRefresh() {
            this._setBusy(true);
            this._loadData();
        },

        // ====== 연·월 분리 조회 필터 ======
        // 로드된 전건에서 고유 연도 목록(오름차순). '전체' 와일드카드 없음.
        _buildYears(aRows) {
            const seen = {};
            (aRows || []).forEach(r => { if (r.Gjahr) { seen[String(r.Gjahr)] = true; } });
            return Object.keys(seen).sort().map(gj => ({ key: gj, text: gj + "년" }));
        },
        // 로드된 전건에서 데이터에 존재하는 월만(1~12 오름차순). '전체' 와일드카드 없음. key=월 숫자문자열("6").
        _buildMonths(aRows) {
            const seen = {};
            (aRows || []).forEach(r => { if (r.Perio) { const m = parseInt(r.Perio, 10); if (!isNaN(m)) { seen[m] = true; } } });
            return Object.keys(seen).map(Number).sort((a, b) => a - b).map(m => ({ key: String(m), text: m + "월" }));
        },
        // 데이터의 최신 (연도, 월) → 기본 선택값(전체 와일드카드가 없으므로 특정 월로 시작)
        _latestYM(aRows) {
            let best = null;
            (aRows || []).forEach(r => {
                if (!r.Gjahr || !r.Perio) { return; }
                const y = parseInt(r.Gjahr, 10), m = parseInt(r.Perio, 10);
                if (isNaN(y) || isNaN(m)) { return; }
                const v = y * 100 + m;
                if (best === null || v > best.v) { best = { v: v, year: String(r.Gjahr), month: String(m) }; }
            });
            return best ? { year: best.year, month: best.month } : { year: "", month: "" };
        },

        // 항목(차원) 기본 선택값(모두 전체)
        _defaultDimSel() {
            const o = {}; AXES.forEach(a => { o[a.key] = "all"; }); return o;
        },

        // 로드된 전건에서 항목별 고유값 목록 생성 (명칭(코드) + '전체')
        _buildDimOptions(aRows) {
            const out = {};
            AXES.forEach(a => {
                const seen = {};
                (aRows || []).forEach(r => {
                    const code = (r[a.field] || "").trim();
                    if (!code || (code in seen)) { return; }
                    const nm = (r[a.text] || "").trim();
                    seen[code] = (nm && nm !== code) ? (nm + " (" + code + ")") : code;
                });
                const list = Object.keys(seen).sort().map(c => ({ key: c, text: seen[c] }));
                list.unshift({ key: "all", text: "전체" });
                out[a.key] = list;
            });
            return out;
        },

        // 기간 키("Gjahr|Perio") → "2026 / 06월" (기존 단일월 형식)
        _periodLabel(sKey) {
            const a = (sKey || "").split("|");
            if (a.length < 2) { return ""; }
            return a[0] + " / " + this._pad(parseInt(a[1], 10)) + "월";
        },

        // 선택 연·월 → 헤더 표시 텍스트 ("2026년 6월")
        _periodText() {
            const y = this._yearSel, m = this._monthSel;
            if (!y && !m) { return "전체"; }
            return (y ? y + "년" : "") + (y && m ? " " : "") + (m ? m + "월" : "");
        },

        // 선택 연·월로 전건을 필터 후 재집계 (클라이언트 필터, 신규 서버호출 없음)
        // 규칙: 선택 연도 == Gjahr AND 선택 월 == Perio(숫자) — 전체 와일드카드 없음
        _applyYM(sYear, sMonth) {
            this._yearSel = sYear || "";
            this._monthSel = sMonth || "";
            const aAll = this._allRows || [];
            const y = this._yearSel, m = this._monthSel;
            let aPeriod;
            if (!y || !m) {
                aPeriod = aAll;   // 안전장치: 선택값 없으면 전건(정상 흐름에선 항상 선택됨)
            } else {
                aPeriod = aAll.filter(r => String(r.Gjahr) === String(y) && String(parseInt(r.Perio, 10)) === String(m));
            }
            // 항목 필터 옵션은 '조회 기간 내 데이터'만으로 생성
            this._periodRows = aPeriod;
            this._dims = this._buildDimOptions(aPeriod);
            // 기간에 존재하지 않는 선택값은 '전체'로 자동 해제
            const sel = this._dimSel || this._defaultDimSel();
            AXES.forEach(a => {
                const v = sel[a.key];
                if (v && v !== "all" && !(this._dims[a.key] || []).some(o => o.key === v)) {
                    sel[a.key] = "all";
                }
            });
            this._dimSel = sel;
            // 항목(차원) 필터 적용 (AND, '전체'는 미적용)
            let aRows = aPeriod;
            AXES.forEach(a => {
                const v = sel[a.key];
                if (v && v !== "all") { aRows = aRows.filter(r => (r[a.field] || "").trim() === v); }
            });
            this._aggregate(aRows);
        },

        // 조회 버튼: 선택 연·월 적용
        onApplyFilter() {
            const oView = this.getView().getModel("view");
            const sYear = oView ? oView.getProperty("/meta/yearSel") : "";
            const sMonth = oView ? oView.getProperty("/meta/monthSel") : "";
            // 항목 선택값: 현재 선택 탭의 항목만 적용(보이는 필터만), 그 외/전체는 미적용
            const sel = this._defaultDimSel();
            const sTab = oView ? oView.getProperty("/meta/selectedTab") : "all";
            if (AXES.some(a => a.key === sTab)) {
                const v = oView ? oView.getProperty("/meta/dimSel/" + sTab) : null;
                sel[sTab] = (v === undefined || v === null || v === "") ? "all" : v;
            }
            this._dimSel = sel;
            this._setBusy(true);
            this._applyYM(sYear, sMonth);
            this._setBusy(false);
        },

        // ====== 탭 선택: 헤더 클릭 시 해당 축으로 ======
        onTabSelect(oEvent) {
            // 항목 선택(라디오 그룹): selectedIndex → 축 키 매핑
            const KEYS = ["prctr", "partner", "matkl", "segment"];
            let iIdx = oEvent.getParameter("selectedIndex");
            if (iIdx === undefined || iIdx === null) {
                const oSrc = oEvent.getSource();
                iIdx = (oSrc && oSrc.getSelectedIndex) ? oSrc.getSelectedIndex() : 0;
            }
            this._selectAxis(KEYS[iIdx] || "prctr");
        },

        // ====== 드릴다운: 개요의 차트/표/버튼 클릭 → 해당 축으로 이동 ======
        onNavToAxis(oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("view");
            if (!oCtx) { return; }
            const oObj = oCtx.getObject() || {};
            let sKey = oObj.key; // 축 객체(개요 axesList 항목 / 상세 바인딩 축)
            if (!sKey) {
                const sPath = oCtx.getPath();
                let m = /^\/axes\/([^/]+)/.exec(sPath);            // 상세 표 행 등: /axes/<key>/...
                if (m) { sKey = m[1]; }
                else {
                    m = /^\/axesList\/(\d+)/.exec(sPath);          // 개요 미니표 행 등: /axesList/<n>/...
                    if (m) {
                        const aList = this.getView().getModel("view").getProperty("/axesList") || [];
                        sKey = aList[parseInt(m[1], 10)] && aList[parseInt(m[1], 10)].key;
                    }
                }
            }
            if (sKey) { this._selectAxis(sKey); }
        },

        // 선택 축 적용: 탭 동기화 + 상세 1블록 재바인딩 + 스크롤 + 차트 재스타일
        _selectAxis(sKey) {
            const oView = this.getView().getModel("view");
            if (oView) {
                oView.setProperty("/meta/selectedTab", sKey);
                oView.setProperty("/meta/productPage", { active: false, matklName: "" });
            }
            // 항목 라디오 그룹의 selectedIndex는 /meta/selectedTab 표현식 바인딩으로 자동 동기화됨(수동 setKey 불필요)
            if (sKey !== "all") {
                const oDetail = this.byId("axisDetail");
                if (oDetail) { oDetail.bindElement({ path: "view>/axes/" + sKey }); }
            }
            this._styleCharts();
            setTimeout(this._styleCharts.bind(this), 0); // 축 전환으로 새로 보이는 시그니처 차트 재스타일(비동기 렌더 후)
            const oPage = this.byId("page");
            if (oPage && oPage.scrollTo) { oPage.scrollTo(0, 200); }
        },

        // ====== 제품군 상세 차트 클릭 → 제품 페이지(해당 제품군으로 필터) ======
        onDetailSelect(oEvent) {
            const oVM = this.getView().getModel("view");
            const sTab = oVM ? oVM.getProperty("/meta/selectedTab") : "all";
            const bProd = oVM ? oVM.getProperty("/meta/productPage/active") : false;
            if (sTab !== "matkl" || bProd) { return; } // 제품군 상세에서만 드릴다운(제품 페이지에선 재드릴 방지)
            let sName = "";
            const aData = oEvent.getParameter("data");
            if (aData && aData.length && aData[0] && aData[0].data) { sName = aData[0].data["항목"]; }
            if (!sName || sName === "기타") { return; }
            const aMembers = (oVM && oVM.getProperty("/axes/matkl/members")) || [];
            let oHit = null;
            for (let i = 0; i < aMembers.length; i++) {
                if (aMembers[i].text === sName || aMembers[i].code === sName) { oHit = aMembers[i]; break; }
            }
            if (!oHit) { return; }
            this._openProductPage(oHit.code, oHit.text);
        },

        _openProductPage(sMatklCode, sMatklName) {
            const oVM = this.getView().getModel("view");
            if (!oVM) { return; }
            const oProd = this._aggregateProduct(sMatklCode);
            oVM.setProperty("/axes/_product", oProd);
            oVM.setProperty("/meta/productPage", { active: true, matklName: sMatklName });
            // selectedTab은 "matkl" 유지(제품군 탭 활성). "_product" 등 무효 키 설정 금지
            //  → IconTabHeader가 무효 키를 첫 탭("전체")으로 되돌리며 양방향 바인딩으로 전체 리디렉션되는 버그 방지
            const oDetail = this.byId("axisDetail");
            if (oDetail) { oDetail.bindElement({ path: "view>/axes/_product" }); }
            this._styleCharts();
            setTimeout(this._styleCharts.bind(this), 0); // 제품 페이지 차트 재스타일(비동기 렌더 후)
            const oPage = this.byId("page");
            if (oPage && oPage.scrollTo) { oPage.scrollTo(0, 200); }
        },

        onProductBack() {
            const oVM = this.getView().getModel("view");
            if (oVM) { oVM.setProperty("/meta/productPage", { active: false, matklName: "" }); }
            this._selectAxis("matkl");
        },

        _aggregateProduct(sMatklCode) {
            const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
            const aRows = ((this._curRows || this._allRows || [])).filter(r => (r.Matkl || "").trim() === sMatklCode);
            const map = {};
            aRows.forEach(r => {
                const code = (r.Matnr || "").trim();
                if (!code) { return; }
                if (!map[code]) { map[code] = { code: code, text: (r.Maktx || "").trim() || code, sales: 0, cost: 0, profit: 0, count: 0 }; }
                const m = map[code];
                m.sales += num(r.Vv010); m.cost += num(r.Vv020); m.profit += num(r.Vv030); m.count += 1;
                if (!m.text || m.text === code) { const t = (r.Maktx || "").trim(); if (t) { m.text = t; } }
            });
            let members = Object.keys(map).map(k => { const m = map[k]; m.rate = m.sales ? (m.profit / m.sales) * 100 : 0; return m; });
            members.sort((x, y) => y.profit - x.profit);
            const top = members.slice(0, TOP_N);
            const chartProfit = top.map(m => ({ name: m.text, value: m.profit }));
            const chartRate = top.map(m => ({ name: m.text, value: Number(m.rate.toFixed(2)) }));
            const chartMix = top.map(m => ({ name: m.text, sales: m.sales, cost: m.cost, profit: m.profit, rate: Number(m.rate.toFixed(2)) }));
            const salesSorted = members.slice().sort((x, y) => y.sales - x.sales);
            const topSales = salesSorted.slice(0, TOP_N);
            const chartSales = topSales.map(m => ({ name: m.text, value: m.sales }));
            const etc = salesSorted.slice(TOP_N).reduce((s, m) => s + m.sales, 0);
            if (etc > 0) { chartSales.push({ name: "기타", value: etc }); }
            const costSorted = members.slice().sort((x, y) => y.cost - x.cost);
            const topCost = costSorted.slice(0, TOP_N);
            const chartCost = topCost.map(m => ({ name: m.text, value: m.cost }));
            const etcCost = costSorted.slice(TOP_N).reduce((s, m) => s + m.cost, 0);
            if (etcCost > 0) { chartCost.push({ name: "기타", value: etcCost }); }
            return { key: "_product", label: "제품", count: members.length, members: members, top3: members.slice(0, 3), chartProfit, chartSales, chartCost, chartRate, chartMix };
        },

        // ====== 데이터 로드 ======
        _loadData() {
            const oData = this.getOwnerComponent().getModel(); // default OData V2 model
            if (!oData) { this._setBusy(false); return; }
            oData.read("/EvalSet", {
                urlParameters: { "$select": SELECT },
                success: (oResp) => {
                    const aRows = (oResp && oResp.results) ? oResp.results : [];
                    this._allRows = aRows;
                    this._years = this._buildYears(aRows);
                    this._months = this._buildMonths(aRows);
                    // 기본 선택: 데이터 최신 연·월 (전체 와일드카드가 없으므로 특정 월로 시작)
                    if (!this._yearSel || !this._monthSel) {
                        const ym = this._latestYM(aRows);
                        this._yearSel = this._yearSel || ym.year;
                        this._monthSel = this._monthSel || ym.month;
                    }
                    if (!this._dimSel) { this._dimSel = this._defaultDimSel(); }
                    this._applyYM(this._yearSel, this._monthSel);
                    this._setBusy(false);
                },
                error: () => {
                    // 실패 시 빈 상태 유지 + busy 해제
                    this._setBusy(false);
                }
            });
        },

        // ====== 집계 ======
        _aggregate(aRows) {
            this._curRows = aRows;
            const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
            const oView = this.getView().getModel("view");
            const oOut = { meta: {}, kpi: {}, axes: {} };

            // KPI: 전체 데이터 기준
            let sumS = 0, sumC = 0, sumP = 0, cur = "KRW";
            let minP = null, maxP = null;
            aRows.forEach(r => {
                sumS += num(r.Vv010); sumC += num(r.Vv020); sumP += num(r.Vv030);
                if (r.Waers) { cur = r.Waers; }
                if (r.Perio) { const p = parseInt(r.Perio, 10); if (minP === null || p < minP) minP = p; if (maxP === null || p > maxP) maxP = p; }
            });
            const gj = aRows.length ? aRows[0].Gjahr : "";
            const sPrevTab0 = (oView && oView.getProperty("/meta/selectedTab")) || "prctr";
            const sPrevTab = (sPrevTab0 === "_product") ? "prctr" : sPrevTab0;
            const curTxt = cur || "KRW";
            const fmtKrw = (v) => Math.round(parseFloat(v) || 0).toLocaleString("ko-KR") + " " + curTxt;
            oOut.kpi = { sales: sumS, cost: sumC, profit: sumP, rate: sumS ? (sumP / sumS) * 100 : 0, currency: cur, salesText: fmtKrw(sumS), costText: fmtKrw(sumC), profitText: fmtKrw(sumP) };
            oOut.meta = {
                busy: false,
                count: aRows.length,
                selectedTab: sPrevTab,
                years: this._years || [],
                months: this._months || [],
                yearSel: this._yearSel || "",
                monthSel: this._monthSel || "",
                dims: this._dims || {},
                dimSel: this._dimSel || this._defaultDimSel(),
                periodText: aRows.length ? this._periodText() : "데이터 없음",
                productPage: { active: false, matklName: "" }
            };

            // 축별 집계
            AXES.forEach(a => {
                const map = {};
                aRows.forEach(r => {
                    const code = (r[a.field] || "").trim();
                    if (!code) { return; }
                    if (a.scoped && PC_SCOPE.length && !PC_SCOPE.some(p => code.indexOf(p) === 0)) { return; }
                    if (!map[code]) {
                        map[code] = { code: code, text: (r[a.text] || "").trim() || code, sales: 0, cost: 0, profit: 0, count: 0 };
                    }
                    const m = map[code];
                    m.sales += num(r.Vv010); m.cost += num(r.Vv020); m.profit += num(r.Vv030); m.count += 1;
                    if (!m.text || m.text === code) { const t = (r[a.text] || "").trim(); if (t) m.text = t; }
                });
                let members = Object.keys(map).map(k => {
                    const m = map[k];
                    m.rate = m.sales ? (m.profit / m.sales) * 100 : 0;
                    return m;
                });
                members.sort((x, y) => y.profit - x.profit);

                // 차트 데이터
                const top = members.slice(0, TOP_N);
                const chartProfit = top.map(m => ({ name: m.text, value: m.profit }));
                const chartRate = top.map(m => ({ name: m.text, value: Number(m.rate.toFixed(2)) }));
                // 다측정 배열(stacked bar / treemap 용): 매출이익 상위 N, 항목별 매출액·매출원가·매출이익·이익률
                const chartMix = top.map(m => ({ name: m.text, sales: m.sales, cost: m.cost, profit: m.profit, rate: Number(m.rate.toFixed(2)) }));
                // 매출액 구성: 상위 N + 기타 (단, 거래처는 전체 거래처를 개별 표시 — 기타 묶음 없음)
                const bAllMembers = (a.key === "partner");
                const salesSorted = members.slice().sort((x, y) => y.sales - x.sales);
                const topSales = bAllMembers ? salesSorted : salesSorted.slice(0, TOP_N);
                const chartSales = topSales.map(m => ({ name: m.text, value: m.sales }));
                if (!bAllMembers) {
                    const etc = salesSorted.slice(TOP_N).reduce((s, m) => s + m.sales, 0);
                    if (etc > 0) { chartSales.push({ name: "기타", value: etc }); }
                }
                // 매출원가 구성: 상위 N + 기타 (단, 거래처는 전체 표시)
                const costSorted = members.slice().sort((x, y) => y.cost - x.cost);
                const topCost = bAllMembers ? costSorted : costSorted.slice(0, TOP_N);
                const chartCost = topCost.map(m => ({ name: m.text, value: m.cost }));
                if (!bAllMembers) {
                    const etcCost = costSorted.slice(TOP_N).reduce((s, m) => s + m.cost, 0);
                    if (etcCost > 0) { chartCost.push({ name: "기타", value: etcCost }); }
                }
                // 매출액 비중(%): 개요 도넛/파이 데이터라벨용 — 표시 슬라이스(상위 N + 기타) 합 대비 각 항목 비율(합계 100%)
                const salesPctTotal = chartSales.reduce((s, d) => s + (d.value || 0), 0);
                const chartSalesPct = chartSales.map(d => ({ name: d.name, value: salesPctTotal ? Number(((d.value || 0) / salesPctTotal * 100).toFixed(1)) : 0 }));

                oOut.axes[a.key] = { key: a.key, label: a.label, count: members.length, members: members, top3: members.slice(0, 3), chartProfit, chartSales, chartSalesPct, chartCost, chartRate, chartRate3: chartRate.slice(0, 3), chartRateAll: members.map(m => ({ name: m.text, value: Number(m.rate.toFixed(2)) })), chartProfitAllEok: members.map(m => ({ name: m.text, value: (m.profit || 0) / 1e8 })), chartSalesAllEok: members.map(m => ({ name: m.text, value: (m.sales || 0) / 1e8 })), chartProfitEok: chartProfit.map(d => ({ name: d.name, value: (d.value || 0) / 1e8 })), chartSalesEok: chartSales.map(d => ({ name: d.name, value: (d.value || 0) / 1e8 })), chartMixEok: chartMix.map(d => ({ name: d.name, sales: (d.sales || 0) / 1e8, cost: (d.cost || 0) / 1e8, profit: (d.profit || 0) / 1e8, rate: d.rate })), chartMix };
            });

            oOut.axesList = AXES.map(a => oOut.axes[a.key]);

            // 적자 레코드 로그(행 단위, 매출이익<0) — 조회기간 기준(this._periodRows). 컬럼: 월/자재명/거래처/매출이익
            const oLossFmt = NumberFormat.getFloatInstance({ groupingEnabled: true, maxFractionDigits: 0 });
            const aLossSrc = ((this._periodRows || aRows) || []).filter(r => num(r.Vv030) < 0);
            aLossSrc.sort((x, y) => {
                const kx = (x.Gjahr || "") + "|" + (x.Perio || ""), ky = (y.Gjahr || "") + "|" + (y.Perio || "");
                if (kx !== ky) { return kx < ky ? -1 : 1; }
                return num(x.Vv030) - num(y.Vv030);
            });
            oOut.lossLog = aLossSrc.map(r => {
                const pf = num(r.Vv030);
                return {
                    month: this._periodLabel((r.Gjahr || "") + "|" + (r.Perio || "")),
                    matnrCode: (r.Matnr || "").trim() || "-",
                    matnr: (r.Maktx || r.Matnr || "").trim() || "-",
                    partnerCode: (r.Partner_no || "").trim() || "-",
                    partner: (r.Comp_name || r.Partner_no || "").trim() || "-",
                    profit: pf,
                    profitText: oLossFmt.format(pf) + " " + (r.Waers || cur || "KRW")
                };
            });
            oOut.meta.lossCount = oOut.lossLog.length;

            oView.setData(oOut);
            // 상세 탭이 선택된 상태로 새로고침된 경우 상세 1블록 재바인딩
            if (oOut.meta.selectedTab && oOut.meta.selectedTab !== "all") {
                const oDetail = this.byId("axisDetail");
                if (oDetail) { oDetail.bindElement({ path: "view>/axes/" + oOut.meta.selectedTab }); }
            }
            this._styleCharts();
        },

        // ====== 차트 스타일 (제목 숨김/범례) ======
        _styleCharts() {
            const aViz = this.getView().findAggregatedObjects(true, (o) => o.isA && o.isA("sap.viz.ui5.controls.VizFrame"));
            const PALETTE = ["#5899DA", "#E8743B", "#19A979", "#ED4A7B", "#945ECF",
                             "#13A4B4", "#525DF4", "#BF399E", "#6C8893", "#EE6868"];
            aViz.forEach((v) => {
                const bMini = v.hasStyleClass && v.hasStyleClass("peMiniViz");
                const bRate = v.hasStyleClass && v.hasStyleClass("peMiniRate"); // 이익률 미니(억 아님, %)
                const bPct = v.hasStyleClass && v.hasStyleClass("peMiniPct");   // 매출액 비중 미니(도넛/파이, %)
                const props = {
                    title: { visible: false },
                    legend: { visible: true },
                    legendGroup: { layout: { position: "right" } },
                    plotArea: { dataLabel: { visible: true, hideWhenOverlap: true, formatString: bMini ? ((bRate || bPct) ? "0.0'%'" : "#,##0.0억") : undefined }, drawingEffect: "glossy" },
                    valueAxis: { title: { visible: false }, label: { visible: !bMini } },
                    categoryAxis: { title: { visible: false }, label: { visible: !bMini } },
                    interaction: { selectability: { mode: "single" } }
                };
                // 손익센터·거래처 축의 막대(column/bar)는 항목(손익센터/BP)별로 색 구분
                const oCtx = v.getBindingContext("view");
                const oObj = oCtx ? oCtx.getObject() : null;
                const sAxis = oObj && oObj.key;
                const sType = v.getVizType();
                if (oObj && (sAxis === "prctr" || sAxis === "matnr" || sAxis === "partner" || sAxis === "matkl" || sAxis === "segment" || sAxis === "_product") && (sType === "column" || sType === "bar")) {
                    const aNames = (oObj.chartProfit || []).map((d) => d.name);
                    props.plotArea.dataPointStyle = {
                        rules: aNames.map((nm, i) => ({
                            dataContext: { "항목": String(nm) },
                            properties: { color: PALETTE[i % PALETTE.length] },
                            displayName: String(nm)
                        }))
                    };
                }
                v.setVizProperties(props);
            });
        },

        onAfterRendering() {
            this._styleCharts();
        },

        // ====== 포맷터 ======
        fmtAmount(v) {
            const oFmt = NumberFormat.getFloatInstance({ groupingEnabled: true, maxFractionDigits: 0 });
            return oFmt.format(parseFloat(v) || 0);
        },
        // KPI 금액 축약: 조/억/만 단위 한글 표기
        fmtAmountShort(v) {
            const n = parseFloat(v) || 0;
            const sign = n < 0 ? "-" : "";
            const a = Math.abs(n);
            const trim = (x) => x.toFixed(1).replace(/\.0$/, "");
            if (a >= 1e12) { return sign + trim(a / 1e12) + "조"; }
            if (a >= 1e8)  { return sign + trim(a / 1e8) + "억"; }
            if (a >= 1e4)  { return sign + trim(a / 1e4) + "만"; }
            return sign + Math.round(a).toLocaleString();
        },
        // KPI 금액: 억 단위 '숫자만' 반환 (단위 '억'은 뷰 ObjectNumber unit으로 분리 표기)
        fmtEok(v) {
            const n = (parseFloat(v) || 0) / 1e8;
            return n.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
        },
        fmtRate(v) {
            return (parseFloat(v) || 0).toFixed(1) + "%";
        },
        stateBySign(v) {
            return (parseFloat(v) || 0) >= 0 ? "Success" : "Error";
        },

        // ====== 내부 유틸 ======
        _emptyKpi() { return { sales: 0, cost: 0, profit: 0, rate: 0, currency: "KRW", salesText: "0 KRW", costText: "0 KRW", profitText: "0 KRW" }; },
        _pad(n) { return (n === null || n === undefined) ? "" : (n < 10 ? "0" + n : "" + n); },
        _setBusy(b) {
            const oView = this.getView().getModel("view");
            if (oView) { oView.setProperty("/meta/busy", b); }
        }
    });
});
