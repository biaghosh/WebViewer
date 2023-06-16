"use strict";
window.bivws = window.bivws || {};
$( function() {
    window.bivws.showLoader = function(show) {
        if (show) {
            $("#loadingshade").css("display", "block");
        }
        else {
            $("#loadingshade").css("display", "none");
        }
    }
});

function showLoader() {
    window.bivws.showLoader(true);
}