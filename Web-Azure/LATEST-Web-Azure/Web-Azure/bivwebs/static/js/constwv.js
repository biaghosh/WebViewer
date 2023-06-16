"use strict";
(function() {
    window.bivws = window.bivws || {};
    var MODALBRPATH = {
        XY: "./static/BrData/XY/imagesXY.",
        YZ: "./static/BrData/YZ/imagesYZ.",
        XZ: "./static/BrData/XZ/imagesXZ."
    }
    var MODALFLPATH = {
        XY: "./static/FlData/XY/fluo_imagesXY.",
        YZ: "./static/FlData/YZ/fluo_imagesYZ.",
        XZ: "./static/FlData/XZ/fluo_imagesXZ."
    }
    var DIMENSIONS = {
        XY: 161,
        XZ: 514,
        YZ: 1082
    }
    var CurSliderVal = {
        xy: 80,
        xz: 256,
        yz: 540
    }

    window.bivws.MODALBRPATH = MODALBRPATH;
    window.bivws.MODALFLPATH = MODALFLPATH;
    window.bivws.DIMENSIONS = DIMENSIONS;
    window.bivws.CurSliderVal = CurSliderVal;

    window.bivws.ModalPath = window.bivws.MODALBRPATH;
}());
