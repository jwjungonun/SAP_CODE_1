sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/SelectDialog",
    "sap/m/StandardListItem"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, SelectDialog, StandardListItem) {
    "use strict";

    return Controller.extend("zpe1coview.zpe1coview.controller.zpe1_co_view", {

        onInit: function () {
            this.getView().setModel(new JSONModel({
                headers: [], items: [], allItems: [], headerCount: 0,
                summary: { belnr: "", budat: "", count: 0, debit: 0, credit: 0, net: 0 },
                chart: [], chartTitle: "생산/매출 현황", chartSub: "전표 항목을 선택하면 표시됩니다", busy: false,
                ext: { kstar: "", kostl: "", prctr: "" },
                f4: { kstar: [], kostl: [], prctr: [] },
                extActive: false
            }), "view");
            this._styleDonut();
        },

        _odata: function () { return this.getOwnerComponent().getModel(); },
        _vm: function () { return this.getView().getModel("view"); },

        // 로컬 Date → UTC 자정(종료일은 23:59:59) 정규화: Edm.DateTime(Date) 필터 타임존 off-by-one 방지
        _toUTCDate: function (d, bEnd) {
            if (!d) { return null; }
            return bEnd
                ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59))
                : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        },

        // ── 조회조건 → Filter 배열 ──────────────────────────────
        _buildFilters: function () {
            var aF = [];
            var sKokrs = (this.byId("fKokrs").getValue() || "").trim();
            var sGjahr = (this.byId("fGjahr").getValue() || "").trim();
            if (sKokrs) { aF.push(new Filter("Kokrs", FilterOperator.EQ, sKokrs)); }
            if (sGjahr) { aF.push(new Filter("Gjahr", FilterOperator.EQ, sGjahr)); }

            var oDrs = this.byId("fBudat");
            var dFrom = this._toUTCDate(oDrs.getDateValue(), false), dTo = this._toUTCDate(oDrs.getSecondDateValue(), true);
            if (dFrom && dTo) { aF.push(new Filter("Budat", FilterOperator.BT, dFrom, dTo)); }
            else if (dFrom) { aF.push(new Filter("Budat", FilterOperator.GE, dFrom)); }
            else if (dTo) { aF.push(new Filter("Budat", FilterOperator.LE, dTo)); }
            return aF;
        },

        _padBelnr: function (s) {
            s = (s || "").trim();
            if (!s) { return ""; }
            return /^\d+$/.test(s) ? s.padStart(10, "0") : s;
        },

        // ── 헤더 조회 (/ViewhSet) ───────────────────────────────
        onSearch: function () {
            var oOData = this._odata(), oVm = this._vm();
            if (!oOData) { MessageToast.show("OData 모델을 찾을 수 없습니다."); return; }
            oVm.setProperty("/busy", true);
            oOData.read("/ViewhSet", {
                filters: this._buildFilters(),
                success: function (oData) {
                    var aRows = (oData && oData.results) || [];
                    this._renderHeaders(aRows);
                    this._loadOverview(aRows);
                    oVm.setProperty("/extActive", false);
                    oVm.setProperty("/busy", false);
                    if (!aRows.length) { MessageToast.show("조회 결과가 없습니다."); }
                }.bind(this),
                error: function (oErr) {
                    oVm.setProperty("/busy", false);
                    MessageBox.error(this._errMsg(oErr, "전표 항목 조회 중 오류가 발생했습니다."));
                }.bind(this)
            });
        },

        onRefresh: function () { this.onSearch(); },

        // ── 공용: 헤더 렌더 + 선택/상세 초기화 ──
        _renderHeaders: function (aRows) {
            var oVm = this._vm();
            oVm.setProperty("/headers", aRows || []);
            oVm.setProperty("/items", []);
            oVm.setProperty("/allItems", []);
            oVm.setProperty("/summary", { belnr: "", budat: "", count: 0, debit: 0, credit: 0, net: 0 });
            oVm.setProperty("/chart", []);
            oVm.setProperty("/chartTitle", "생산/매출 현황");
            oVm.setProperty("/chartSub", "전표 항목을 선택하면 표시됩니다");
            var oTab = this.byId("hdrTable"); if (oTab) { oTab.removeSelections(true); }
            this._applyHeaderSearch();
        },

        // 아이템(ViewiSet) 조회용 스코프 필터 — 아이템에 존재하는 필드만(Budat 제외)
        _itemScopeFilters: function () {
            var aF = [];
            var sKokrs = (this.byId("fKokrs").getValue() || "").trim();
            var sGjahr = (this.byId("fGjahr").getValue() || "").trim();
            if (sKokrs) { aF.push(new Filter("Kokrs", FilterOperator.EQ, sKokrs)); }
            if (sGjahr) { aF.push(new Filter("Gjahr", FilterOperator.EQ, sGjahr)); }
            return aF;
        },

        _readErr: function (oErr) {
            this._vm().setProperty("/busy", false);
            MessageBox.error(this._errMsg(oErr, "조회 중 오류가 발생했습니다."));
        },

        // ── 확장 조회 팝업 ──────────────────────────────────────
        onOpenExtended: function () {
            this._loadF4();                 // 현재 스코프의 ViewiSet distinct → F4
            this.byId("extDialog").open();
        },
        onCloseExtended: function () { var d = this.byId("extDialog"); if (d) { d.close(); } },
        onClearExtended: function () { this._vm().setProperty("/ext", { kstar: "", kostl: "", prctr: "" }); },

        // 간이 F4 데이터: 필터바(Kokrs/Gjahr/Belnr) 스코프의 ViewiSet에서 distinct
        _loadF4: function () {
            var oOData = this._odata(), oVm = this._vm();
            oOData.read("/ViewiSet", {
                filters: this._itemScopeFilters(),
                success: function (oI) {
                    var aItems = (oI && oI.results) || [];
                    oVm.setProperty("/f4", {
                        kstar: this._distinct(aItems, "Kstar", "Ltext"),
                        kostl: this._distinct(aItems, "Kostl", "Ktext"),
                        prctr: this._distinct(aItems, "Prctr", "Ptext")
                    });
                }.bind(this),
                error: function () { oVm.setProperty("/f4", { kstar: [], kostl: [], prctr: [] }); }
            });
        },
        _distinct: function (aRows, sCode, sText) {
            var oMap = {};
            (aRows || []).forEach(function (r) {
                var c = (r[sCode] || "").trim(); if (!c) { return; }
                if (!oMap[c]) { oMap[c] = { code: c, text: (r[sText] || "").trim() }; }
            });
            return Object.keys(oMap).sort().map(function (k) { return oMap[k]; });
        },

        // ── F4 (Search Help) ──
        onF4Kstar: function () { this._openF4("kstar", "원가요소 선택"); },
        onF4Kostl: function () { this._openF4("kostl", "코스트센터 선택"); },
        onF4Prctr: function () { this._openF4("prctr", "손익센터 선택"); },
        _openF4: function (sField, sTitle) {
            var that = this;
            var aList = this._vm().getProperty("/f4/" + sField) || [];
            var oSD = new SelectDialog({
                title: sTitle, multiSelect: false, growing: false,
                noDataText: "표시할 값이 없습니다. 먼저 [조회]로 데이터를 불러오세요.",
                items: {
                    path: "/items",
                    template: new StandardListItem({ title: "{code}", description: "{text}" })
                },
                search: function (oEv) {
                    var q = oEv.getParameter("value") || "";
                    var aFil = q ? [new Filter({ filters: [
                        new Filter("code", FilterOperator.Contains, q),
                        new Filter("text", FilterOperator.Contains, q)
                    ], and: false })] : [];
                    oEv.getSource().getBinding("items").filter(aFil);
                },
                confirm: function (oEv) {
                    var oSel = oEv.getParameter("selectedItem");
                    if (oSel) { that._vm().setProperty("/ext/" + sField, oSel.getTitle()); }
                    oEv.getSource().destroy();
                },
                cancel: function (oEv) { oEv.getSource().destroy(); }
            });
            oSD.setModel(new JSONModel({ items: aList }));
            oSD.open();
        },

        // ── 확장 조회 실행 (B안: 헤더 세미조인) ──
        onExtendedSearch: function () {
            var oOData = this._odata(), oVm = this._vm();
            var oExt = oVm.getProperty("/ext") || {};
            var sKstar = (oExt.kstar || "").trim(), sKostl = (oExt.kostl || "").trim(), sPrctr = (oExt.prctr || "").trim();
            if (!sKstar && !sKostl && !sPrctr) {
                MessageToast.show("확장 조건(원가요소/코스트센터/손익센터)을 1개 이상 입력하세요."); return;
            }
            oVm.setProperty("/busy", true);
            // 1) 헤더 = 기존 필터바 조건
            oOData.read("/ViewhSet", {
                filters: this._buildFilters(),
                success: function (oH) {
                    var aHeaders = (oH && oH.results) || [];
                    // 2) 아이템 = 필터바(아이템필드) + 확장조건 → 매칭 전표키 집합
                    var aItemF = this._itemScopeFilters();
                    if (sKstar) { aItemF.push(new Filter("Kstar", FilterOperator.EQ, sKstar)); }
                    if (sKostl) { aItemF.push(new Filter("Kostl", FilterOperator.EQ, sKostl)); }
                    if (sPrctr) { aItemF.push(new Filter("Prctr", FilterOperator.EQ, sPrctr)); }
                    oOData.read("/ViewiSet", {
                        filters: aItemF,
                        success: function (oI) {
                            var aItems = (oI && oI.results) || [];
                            var oSet = {};
                            aItems.forEach(function (r) { oSet[r.Kokrs + "|" + r.Belnr + "|" + r.Gjahr] = true; });
                            // 3) 교집합: 매칭 아이템을 가진 전표만 남김
                            var aFiltered = aHeaders.filter(function (h) {
                                return oSet[h.Kokrs + "|" + h.Belnr + "|" + h.Gjahr];
                            });
                            this._renderHeaders(aFiltered);
                            this._loadOverview(aFiltered);
                            // 확장 조회: 매칭된 전표에 속한 조건 충족 아이템을 상세에 바로 표시
                            var oKeep = {};
                            aFiltered.forEach(function (h) { oKeep[h.Kokrs + "|" + h.Belnr + "|" + h.Gjahr] = true; });
                            var aShowItems = aItems.filter(function (r) { return oKeep[r.Kokrs + "|" + r.Belnr + "|" + r.Gjahr]; });
                            oVm.setProperty("/items", aShowItems);
                            oVm.setProperty("/allItems", aShowItems);
                            oVm.setProperty("/extActive", true);
                            oVm.setProperty("/busy", false);
                            this.onCloseExtended();
                            MessageToast.show("확장 조회 결과: 전표 번호 " + aFiltered.length + "건");
                        }.bind(this),
                        error: this._readErr.bind(this)
                    });
                }.bind(this),
                error: this._readErr.bind(this)
            });
        },

        // 조회 결과(헤더 목록)에 필터바 검색어(전표번호/유형/명칭 부분일치) 적용
        _applyHeaderSearch: function () {
            var oVm = this._vm();
            var oTab = this.byId("hdrTable");
            var oBinding = oTab && oTab.getBinding("items");
            if (!oBinding) { oVm.setProperty("/headerCount", (oVm.getProperty("/headers") || []).length); return; }
            var oSf = this.byId("fSearch");
            var sQ = ((oSf && oSf.getValue()) || "").trim();
            if (!sQ) { oBinding.filter([]); }
            else { oBinding.filter(new Filter("Belnr", FilterOperator.Contains, sQ)); }
            oVm.setProperty("/headerCount", oBinding.getLength());
        },

        // ── 헤더 선택 → 아이템 조회 (to_Items 네비게이션) ──
        onSelectHeader: function (oEvent) {
            var oItem = oEvent.getParameter("listItem") || oEvent.getSource().getSelectedItem();
            if (!oItem) { return; }
            var oCtx = oItem.getBindingContext("view");
            if (!oCtx) { return; }
            var oHdr = oCtx.getObject();
            var oOData = this._odata(), oVm = this._vm();
            var sKey = oOData.createKey("ViewhSet", { Kokrs: oHdr.Kokrs, Belnr: oHdr.Belnr, Gjahr: oHdr.Gjahr });
            oVm.setProperty("/busy", true);
            oOData.read("/" + sKey + "/to_Items", {
                success: function (oData) {
                    var aItems = (oData && oData.results) || [];
                    oVm.setProperty("/items", aItems);
                    oVm.setProperty("/allItems", aItems);
                    this._buildSummary(oHdr, aItems);
                    // 헤더 클릭 시 차트는 전체 생산/매출 현황을 그대로 유지 (제품별/원가구분 차트 미표시)
                    oVm.setProperty("/busy", false);
                }.bind(this),
                error: function (oErr) {
                    oVm.setProperty("/busy", false);
                    MessageBox.error(this._errMsg(oErr, "전표 항목 상세 조회 중 오류가 발생했습니다."));
                }.bind(this)
            });
        },

        // ── 요약(차변/대변/순액) ──
        _buildSummary: function (oHdr, aItems) {
            var debit = 0, credit = 0;
            (aItems || []).forEach(function (r) {
                var v = parseFloat(r.Dmbtr) || 0;
                if (r.Shkzg === "H") { credit += v; } else { debit += v; }
            });
            this._vm().setProperty("/summary", {
                belnr: oHdr.Belnr,
                budat: this.fmtDate(oHdr.Budat),
                count: (aItems || []).length,
                debit: debit, credit: credit, net: debit - credit
            });
        },

        // ── 도넛: 원가구분(CSTYP)별 금액 ──
        // ── 전체 개요: 조회된 전표 전체의 생산 vs 매출 금액 ──
        _loadOverview: function (aHeaders) {
            var oOData = this._odata();
            if (!(aHeaders || []).length) { this._setOverviewEmpty(); return; }
            var oKeySet = {};
            aHeaders.forEach(function (h) { oKeySet[h.Kokrs + "|" + h.Belnr + "|" + h.Gjahr] = true; });
            oOData.read("/ViewiSet", {
                filters: this._itemScopeFilters(),
                success: function (oI) {
                    var aItems = ((oI && oI.results) || []).filter(function (r) {
                        return oKeySet[r.Kokrs + "|" + r.Belnr + "|" + r.Gjahr];
                    });
                    this._buildOverviewChart(aItems);
                }.bind(this),
                error: function () { this._setOverviewEmpty(); }.bind(this)
            });
        },

        _buildOverviewChart: function (aItems) {
            var prod = 0, sales = 0;
            (aItems || []).forEach(function (r) {
                var k = (r.Kstar || "").trim(), v = parseFloat(r.Dmbtr) || 0;
                if (k === "41000010") { sales += v; }
                else if (k === "51000030" && (r.Shkzg || "").trim() === "H") { prod += v; }
            });
            var total = prod + sales;
            var fmt = this.fmtAmt.bind(this);
            var label = function (sBase, val) {
                var pct = total > 0 ? (val / total * 100).toFixed(1) : "0.0";
                return sBase + "  " + fmt(val) + "원 (" + pct + "%)";
            };
            var aChart = [];
            if (prod > 0) { aChart.push({ name: label("생산", prod), value: prod }); }
            if (sales > 0) { aChart.push({ name: label("매출", sales), value: sales }); }
            var oVm = this._vm();
            oVm.setProperty("/chart", aChart);
            oVm.setProperty("/chartTitle", "전체 생산/매출 현황");
            oVm.setProperty("/chartSub", "조회된 전표 전체 — 생산 vs 매출 금액 (DMBTR)");
        },

        _setOverviewEmpty: function () {
            var oVm = this._vm();
            oVm.setProperty("/chart", []);
            oVm.setProperty("/chartTitle", "전체 생산/매출 현황");
            oVm.setProperty("/chartSub", "조회 결과가 없습니다.");
        },

        // ── 생산/매출 현황 차트 (전표 유형 분기) ──
        //   매출(KSTAR 41000010): 제품(Matnr)별 매출 금액(DMBTR)
        //   생산(KSTAR 51000030, 완제품 산출 SHKZG=H): 제품별 생산 금액(DMBTR)
        //   그 외: 원가구분(CSTYP)별 금액 (대체)
        _buildChart: function (aItems) {
            aItems = aItems || [];
            var bSales = aItems.some(function (r) { return (r.Kstar || "").trim() === "41000010"; });
            var bProd = aItems.some(function (r) { return (r.Kstar || "").trim() === "51000030"; });
            var aChart, sTitle, sSub;

            if (bSales) {
                aChart = this._sumByProduct(aItems.filter(function (r) {
                    return (r.Kstar || "").trim() === "41000010";
                }));
                sTitle = "제품별 매출 금액";
                sSub = "매출 전표 — 제품별 매출액 (DMBTR)";
            } else if (bProd) {
                aChart = this._sumByProduct(aItems.filter(function (r) {
                    return (r.Kstar || "").trim() === "51000030" && (r.Shkzg || "").trim() === "H";
                }));
                sTitle = "제품별 생산 금액";
                sSub = "생산 전표 — 완제품 산출 금액 (DMBTR)";
            } else {
                var oMap = {};
                aItems.forEach(function (r) {
                    var k = (r.Cstyp || "").trim() || "기타";
                    oMap[k] = (oMap[k] || 0) + (parseFloat(r.Dmbtr) || 0);
                });
                aChart = Object.keys(oMap).sort().map(function (k) { return { name: k, value: oMap[k] }; });
                sTitle = "원가구분별 금액";
                sSub = "선택 전표 상세 항목의 원가 구분별 금액";
            }
            var oVm = this._vm();
            oVm.setProperty("/chart", aChart);
            oVm.setProperty("/chartTitle", sTitle);
            oVm.setProperty("/chartSub", sSub);
        },

        // 제품(Matnr/Maktx)별 DMBTR 합 → 파이 데이터
        _sumByProduct: function (aRows) {
            var oMap = {};
            (aRows || []).forEach(function (r) {
                var sName = (r.Maktx || "").trim() || (r.Matnr || "").trim() || "(제품 미지정)";
                oMap[sName] = (oMap[sName] || 0) + (parseFloat(r.Dmbtr) || 0);
            });
            return Object.keys(oMap).sort().map(function (k) { return { name: k, value: oMap[k] }; });
        },

        _styleDonut: function () {
            var oVF = this.byId("docCstypDonut");
            if (!oVF) { return; }
            oVF.setVizProperties({
                plotArea: {
                    drawingEffect: "glossy",
                    colorPalette: ["#0a6ed1", "#1aa06d", "#e9a23b", "#7858c8", "#d9534f", "#16a3b8", "#8a8d91"],
                    dataLabel: { visible: true }
                },
                legend: { visible: true, layout: { position: "bottom" } },
                title: { visible: false },
                tooltip: { visible: true }
            });
        },

        // ── 포맷터 ──────────────────────────────────────────────
        _errMsg: function (oErr, sFallback) {
            try { return JSON.parse(oErr.responseText).error.message.value || sFallback; }
            catch (e) { return sFallback; }
        },

        fmtDate: function (v) {
            if (!v) { return ""; }
            var d = (v instanceof Date) ? v : new Date(v);
            if (isNaN(d.getTime())) { return "" + v; }
            var m = ("0" + (d.getMonth() + 1)).slice(-2), day = ("0" + d.getDate()).slice(-2);
            return d.getFullYear() + "-" + m + "-" + day;
        },

        fmtAmt: function (v) {
            var n = parseFloat(v);
            if (isNaN(n)) { return ""; }
            return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
        },

        fmtBlart: function (v) { return v || ""; },

        fmtStatusState: function (v) { return v === "S" ? "Success" : "None"; },

        fmtShkzgText: function (v) { return v === "H" ? "대변" : "차변"; },
        fmtShkzgState: function (v) { return v === "H" ? "Warning" : "Success"; }
    });
});
