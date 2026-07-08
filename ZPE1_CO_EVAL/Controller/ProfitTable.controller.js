sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/format/NumberFormat",
    "sap/ui/core/routing/History"
], (Controller, NumberFormat, History) => {
    "use strict";

    const VALID_AXES = ["prctr", "matnr", "partner", "matkl", "segment"];

    return Controller.extend("zpe1coeval.zpe1coeval.controller.ProfitTable", {

        onInit() {
            this.getOwnerComponent().getRouter()
                .getRoute("RouteProfitTable")
                .attachPatternMatched(this._onMatched, this);
        },

        _onMatched(oEvent) {
            const sAxis = oEvent.getParameter("arguments").axis;
            const oModel = this.getView().getModel("view");
            if (!oModel) { return; }
            const aAll = oModel.getProperty("/axesList") || [];
            let aShow;
            if (sAxis === "_product") {
                // 제품 페이지에서 진입: 드릴다운된 제품군의 제품 축(_product) 단독 표시
                const oProd = oModel.getProperty("/axes/_product");
                aShow = oProd ? [oProd] : [];
            } else if (VALID_AXES.indexOf(sAxis) !== -1) {
                // 특정 표준 축이면 그 축만
                aShow = aAll.filter(a => a && a.key === sAxis);
            } else {
                // 'all'(또는 알 수 없는 값)이면 전체 축
                aShow = aAll.slice();
            }
            oModel.setProperty("/meta/ptAxes", aShow);
        },

        onNavBack() {
            const oHistory = History.getInstance();
            const sPrev = oHistory.getPreviousHash();
            if (sPrev !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("RouteZPE1_CO_EVAL", {}, true);
            }
        },

        // ===== 포맷터 (메인과 동일) =====
        fmtAmount(v) {
            const oFmt = NumberFormat.getFloatInstance({ groupingEnabled: true, maxFractionDigits: 0 });
            return oFmt.format(parseFloat(v) || 0);
        },
        fmtRate(v) {
            return (parseFloat(v) || 0).toFixed(1) + "%";
        },
        stateBySign(v) {
            return (parseFloat(v) || 0) >= 0 ? "Success" : "Error";
        }
    });
});
