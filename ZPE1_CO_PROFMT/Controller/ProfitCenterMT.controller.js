sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/format/DateFormat"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, DateFormat) {
    "use strict";

    return Controller.extend("zpe1coprofmt.zpe1coprofmt.controller.ProfitCenterMT", {

        onInit: function () {
            this._oDateFmt = DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
            this.getView().setModel(new JSONModel({ results: [], chart: [], chartYear: [], busy: false }), "view");
            this._styleDonut();
            this._styleColumn();
            this._load();
        },

        _odata: function () {
            return this.getOwnerComponent().getModel();
        },

        // ── 손익센터 목록 조회 (/ProfitCenterSet) ──────────────
        _load: function () {
            var oOData = this._odata();
            var oView = this.getView().getModel("view");
            if (!oOData) { MessageToast.show("OData 모델을 찾을 수 없습니다."); return; }
            oView.setProperty("/busy", true);
            oOData.read("/ProfitCenterSet", {
                success: function (oData) {
                    var aRows = (oData && oData.results) || [];
                    oView.setProperty("/results", aRows);
                    this._buildChart(aRows);
                    this._buildYearChart(aRows);
                    oView.setProperty("/busy", false);
                }.bind(this),
                error: function (oErr) {
                    oView.setProperty("/busy", false);
                    MessageBox.error(this._errMsg(oErr, "손익센터 목록 조회 중 오류가 발생했습니다."));
                }.bind(this)
            });
        },

        onRefresh: function () { this._load(); },

        onSearch: function (oEvent) {
            var sQuery = (oEvent.getParameter("newValue") || oEvent.getParameter("query") || "").trim();
            var oBinding = this.byId("pcTable").getBinding("items");
            if (!oBinding) { return; }
            if (!sQuery) { oBinding.filter([]); return; }
            oBinding.filter(new Filter({
                filters: [
                    new Filter("Prctr", FilterOperator.Contains, sQuery),
                    new Filter("Ptext", FilterOperator.Contains, sQuery)
                ],
                and: false
            }));
        },

        // ── 도넛 데이터: PRCTR 접두(PCA/PCC/PCL/PCP)별 손익센터 수 ──
        _buildChart: function (aRows) {
            var aOrder = ["PCA", "PCC", "PCL", "PCP"];
            var oMap = {};
            (aRows || []).forEach(function (r) {
                var sPrefix = ((r.Prctr || "").split("_")[0]) || "기타";
                oMap[sPrefix] = (oMap[sPrefix] || 0) + 1;
            });
            var aKeys = Object.keys(oMap).sort(function (a, b) {
                var ia = aOrder.indexOf(a), ib = aOrder.indexOf(b);
                if (ia < 0) { ia = 99; }
                if (ib < 0) { ib = 99; }
                return (ia - ib) || (a < b ? -1 : 1);
            });
            var aChart = aKeys.map(function (k) { return { name: k, value: oMap[k] }; });
            this.getView().getModel("view").setProperty("/chart", aChart);
        },

        // ── 도넛 글로시 스타일 ──────────────────────────────────
        _styleDonut: function () {
            var oVF = this.byId("pcDonut");
            if (!oVF) { return; }
            oVF.setVizProperties({
                plotArea: {
                    drawingEffect: "glossy",
                    colorPalette: ["#0a6ed1", "#1aa06d", "#e9a23b", "#7858c8", "#6a7d8f"]
                },
                legend: { visible: true },
                title: { visible: false },
                tooltip: { visible: true }
            });
        },

        // ── 컬럼 데이터: DATAB(유효시작일) 연도별 손익센터 수 ──
        _buildYearChart: function (aRows) {
            var oMap = {};
            (aRows || []).forEach(function (r) {
                var d = r.Datab;
                if (!d) { return; }
                var oDate = (d instanceof Date) ? d : new Date(d);
                if (isNaN(oDate.getTime())) { return; }
                var sYear = String(oDate.getFullYear());
                oMap[sYear] = (oMap[sYear] || 0) + 1;
            });
            var aYears = Object.keys(oMap).sort();   // 연도 오름차순
            var aChart = aYears.map(function (y) { return { year: y, value: oMap[y] }; });
            this.getView().getModel("view").setProperty("/chartYear", aChart);
        },

        // ── 컬럼 차트 글로시 스타일 ──────────────────────────────
        _styleColumn: function () {
            var oVF = this.byId("pcYearCol");
            if (!oVF) { return; }
            oVF.setVizProperties({
                plotArea: { drawingEffect: "glossy", dataPointSize: { min: 40, max: 40 }, colorPalette: ["#0a6ed1", "#1aa06d", "#e9a23b", "#7858c8", "#d9534f", "#16a3b8", "#8a8d91"] },
                valueAxis: { title: { visible: false } },
                categoryAxis: { title: { visible: false } },
                legend: { visible: false },
                title: { visible: false },
                tooltip: { visible: true }
            });
        },
        onToggleLoekz: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("view");
            if (!oCtx) { return; }
            var oRow = oCtx.getObject();
            var bNew = !this._isX(oRow.Loekz);
            var sActTxt = bNew ? "삭제표시 설정" : "삭제표시 해제";
            MessageBox.confirm(
                "손익센터 [" + oRow.Prctr + "] " + (oRow.Ptext || "") + "\n" + sActTxt + " 하시겠습니까?",
                {
                    title: sActTxt,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) { this._update(oRow, bNew); }
                    }.bind(this)
                }
            );
        },

        _update: function (oRow, bNew) {
            var oOData = this._odata();
            var oView = this.getView().getModel("view");
            var sKey = oOData.createKey("/ProfitCenterSet", {
                Kokrs: oRow.Kokrs,
                Prctr: oRow.Prctr,
                Datbi: oRow.Datbi
            });
            oView.setProperty("/busy", true);
            oOData.update(sKey, { Loekz: bNew }, {
                success: function () {
                    oView.setProperty("/busy", false);
                    MessageToast.show(bNew ? "삭제표시를 설정했습니다." : "삭제표시를 해제했습니다.");
                    this._load();
                }.bind(this),
                error: function (oErr) {
                    oView.setProperty("/busy", false);
                    MessageBox.error(this._errMsg(oErr, "수정 중 오류가 발생했습니다."));
                }.bind(this)
            });
        },

        // ── 헬퍼 / 포맷터 ───────────────────────────────────────
        _isX: function (v) { return v === true || v === "X" || v === "x"; },

        _errMsg: function (oErr, sFallback) {
            try { return JSON.parse(oErr.responseText).error.message.value || sFallback; }
            catch (e) { return sFallback; }
        },

        _fmtDate: function (v) {
            if (!v) { return ""; }
            var oDate = (v instanceof Date) ? v : new Date(v);
            return isNaN(oDate.getTime()) ? "" : this._oDateFmt.format(oDate);
        },

        fmtPeriod: function (dFrom, dTo) {
            return this._fmtDate(dFrom) + " ~ " + this._fmtDate(dTo);
        },

        fmtLoekzText: function (v) { return this._isX(v) ? "비활성화" : "활성화"; },
        fmtLoekzState: function (v) { return this._isX(v) ? "Error" : "Success"; },
        fmtBtnText: function (v) { return this._isX(v) ? "활성화 실행" : "비활성화 실행"; },
        fmtBtnIcon: function (v) { return this._isX(v) ? "sap-icon://undo" : "sap-icon://delete"; }
    });
});
