"use strict";
$( function() {
    // assume that we know the image size;
    // 1082 x 514 x 161;
    const imgWidth = window.bivws.DIMENSIONS.YZ;
    const imgHeight = window.bivws.DIMENSIONS.XZ;
    const imgDepth = window.bivws.DIMENSIONS.XY;
    let wQuadrant = Math.floor(window.innerWidth / 2);
    let hQuadrant = Math.floor(window.innerHeight / 2);
    let result = {width: 0, height: 0}
    //these will be derived from the tiff file ideally
    let src = window.bivws.ModalPath.XY + "0080.png";
    createImage("xyQuadArea", "xyImg", src,
                "XY plane image", result.width, result.height);
    src = window.bivws.ModalPath.XZ + "0256.png";
    createImage("xzQuadArea", "xzImg", src,
                "XZ plane image", result.width, result.height);
    src = window.bivws.ModalPath.YZ + "0540.png";
    createImage("yzQuadArea", "yzImg", src,
                "YZ plane image", result.width, result.height);
    function createImage(pId, id, src, alt, w, h) {
        let img = document.getElementById(id)
        img.alt = alt;
        img.crossOrigin = "anonymous";
        img.src = src;
        img.className = "img-fluid"
    }
    
    
    /**   Cross hair section on 2d planes    */
    var xyContext, xzContext, yzContext
    var xyImgCanvas = document.getElementById("xyImgCanvas")
    var xzImgCanvas = document.getElementById("xzImgCanvas")
    var yzImgCanvas = document.getElementById("yzImgCanvas")
    const xzImgCanvasContext = xzImgCanvas.getContext("2d")
    const yzImgCanvasContext = yzImgCanvas.getContext("2d")
    //for iterating through tags for when I condense code
    var planes = ['xy','xz','yz']
    //to address a bug when sliding through images
    var canvasDimensions = {
        xy : {w:0, h:0},
        xz : {w:0, h:0},
        yz : {w:0, h:0}
    }
    var voxels = {x: 81.92, y: 81.92, z: 160}
    var crosshairValues = {
        xy : {w:0, h:0, rw:0, rh:0},
        xz : {w:0, h:0, rw:0, rh:0},
        yz : {w:0, h:0, rw:0, rh:0}
    }

    let img = document.getElementById("xyImg")
    
    img.addEventListener("load", (e) => {
        
        let canvas = document.getElementById("xyCanvas")
        if (!canvas){
        canvas = document.createElement("canvas")
        canvas.id = 'xyCanvas'
        xyContext = canvas.getContext('2d')
        canvas.width = img.width
        canvas.height = img.height
        canvasDimensions.xy.w = img.width
        canvasDimensions.xy.h = img.height
        document.getElementById("xyQuadArea").appendChild(canvas)

        canvas.style.position = "absolute"
        canvas.style.left = img.offsetLeft + "px"
        canvas.style.top = img.offsetTop + "px"
        //horzontal
        xyContext.clearRect(0, 0, canvas.width, canvas.height);
        xyContext.beginPath();
        xyContext.strokeStyle = 'red';
        xyContext.lineWidth = 1;
        crosshairValues.xy.h = canvas.height/2
        crosshairValues.xy.rh = canvas.height/2
        xyContext.moveTo(0, canvas.height/2);
        xyContext.lineTo(canvas.width, canvas.height/2);
        xyContext.stroke();
        xyContext.closePath();

        xyContext.beginPath();
        xyContext.strokeStyle = 'green';
        xyContext.lineWidth = 1;
        crosshairValues.xy.w = canvas.width/2
        crosshairValues.xy.rw = canvas.width/2
        xyContext.moveTo(canvas.width/2, 0);
        xyContext.lineTo(canvas.width/2, canvas.height);
        xyContext.stroke();
        xyContext.closePath();
        } else {
            //Redraw lines on other axises

            //Correct way to get percentage?
            let xySlice = document.getElementById("xySlider").value / document.getElementById("xySlider").max
            let xzCanvas = document.getElementById("xzCanvas")
            
            xzContext.clearRect(0, 0, xzCanvas.width, xzCanvas.height);
            xzContext.beginPath();
            xzContext.strokeStyle = 'red';
            xzContext.lineWidth = 1;
            let resultingHeight = xzCanvas.height * xySlice;
            crosshairValues.xz.h = resultingHeight
            crosshairValues.xz.rh = resultingHeight
            xzContext.moveTo(0, resultingHeight);
            xzContext.lineTo(xzCanvas.width, resultingHeight);
            xzContext.stroke();
            xzContext.closePath();

            xzContext.beginPath();
            xzContext.strokeStyle = 'blue';
            xzContext.lineWidth = 1;
            xzContext.moveTo(crosshairValues.xz.w, 0);
            xzContext.lineTo(crosshairValues.xz.rw, xzCanvas.height);
            xzContext.stroke();
            xzContext.closePath();

            let yzCanvas = document.getElementById("yzCanvas")
            //this seems to be flipped, make sure that's the case with all the data
            yzContext.clearRect(0, 0, yzCanvas.width, yzCanvas.height);
            yzContext.beginPath();
            yzContext.strokeStyle = 'red';
            yzContext.lineWidth = 1;
            //resultingHeight = Math.abs(1 - (yzCanvas.height * xySlice));
            resultingHeight = Math.abs(yzCanvas.height * xySlice);
            yzContext.moveTo(0, yzCanvas.height - resultingHeight);
            yzContext.lineTo(yzCanvas.width, yzCanvas.height - resultingHeight);
            yzContext.stroke();
            yzContext.closePath();

            yzContext.beginPath();
            yzContext.strokeStyle = 'blue';
            yzContext.lineWidth = 1;
            yzContext.moveTo(yzCanvas.width/2, 0);
            yzContext.lineTo(yzCanvas.width/2, yzCanvas.height);
            yzContext.stroke();
            yzContext.closePath();

        }
        /**interactive section, this feature will be added later
        canvas.addEventListener('mousemove', e => {
        // const canvas = document.getElementById('xyImgcan');
            const context = canvas.getContext('2d');
            document.documentElement.style.cursor="crosshair";
            //var x = e.pageX - this.offsetLeft;
            //var y = e.pageY - this.offsetTop;
            let x = e.offsetX;
            let y = e.offsetY;
            
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.beginPath();
            context.strokeStyle = 'red';
            context.lineWidth = 2;
            context.moveTo(0, y);
            context.lineTo(canvas.width, y);
            context.stroke();
            context.closePath();

            context.beginPath();
            context.strokeStyle = 'green';
            context.lineWidth = 2;
            context.moveTo(x, 0);
            context.lineTo(x, canvas.height);
            context.stroke();
            context.closePath();
            
        });
        canvas.addEventListener("mouseleave", (e) => {
            document.documentElement.style.cursor="auto";
        })
        **/
    })
    
    let img2 = document.getElementById("xzImg")
    img2.addEventListener("load", (e) => {
        if (canvasDimensions.xz.w == 0) {
            canvasDimensions.xz.w = img2.width
            canvasDimensions.xz.h = img2.height * ( voxels.z / voxels.x )
        }

        xzImgCanvas.width = canvasDimensions.xz.w
        xzImgCanvas.height = canvasDimensions.xz.h

        //need to store actual picture size HARDCODED FIX
        let scaleRatio = xzImgCanvas.width / 1082
        //this will need to be visited upon another dataset
        xzImgCanvasContext.scale(voxels.y / voxels.x * scaleRatio, voxels.z / voxels.x * scaleRatio)
        //xzImgCanvasContext.save()
        xzImgCanvasContext.drawImage(img2, 0, 0 )
        img2.style.display = "none"
        
        let canvas = document.getElementById("xzCanvas")
        if (!canvas){

            let canvas = document.createElement("canvas")
            canvas.id = 'xzCanvas'
            xzContext = canvas.getContext('2d')
            canvas.width = xzImgCanvas.width
            canvas.height = xzImgCanvas.height
            document.getElementById("xzQuadArea").appendChild(canvas)
            
            canvas.style.position = "absolute"
            canvas.style.left = xzImgCanvas.offsetLeft + "px"
            canvas.style.top = xzImgCanvas.offsetTop + "px"
            
            xzContext.clearRect(0, 0, canvas.width, canvas.height);
            xzContext.beginPath();
            xzContext.strokeStyle = 'red';
            xzContext.lineWidth = 1;
            xzContext.moveTo(0, canvas.height/2);
            crosshairValues.xz.h = canvas.height/2
            crosshairValues.xz.rh = canvas.height/2
            xzContext.lineTo(canvas.width, canvas.height/2);
            xzContext.stroke();
            xzContext.closePath();

            xzContext.beginPath();
            xzContext.strokeStyle = 'blue';
            xzContext.lineWidth = 1;
            crosshairValues.xz.w = canvas.width/2
            crosshairValues.xz.rw = canvas.width/2
            xzContext.moveTo(canvas.width/2, 0);
            xzContext.lineTo(canvas.width/2, canvas.height);
            xzContext.stroke();
            xzContext.closePath(); 
        } else {
            //Redraw lines on other axises

            //Correct way to get percentage?, also hardcoded and values will need to be fetched
            let xzSlice = document.getElementById("xzSlider").value / 513
            let xyCanvas = document.getElementById("xyCanvas")
            
            xyContext.clearRect(0, 0, xyCanvas.width, xyCanvas.height);
            xyContext.beginPath();
            xyContext.strokeStyle = 'red';
            xyContext.lineWidth = 1;
            let resultingHeight = xyCanvas.height * xzSlice;
            xyContext.moveTo(0, resultingHeight);
            xyContext.lineTo(xyCanvas.width, resultingHeight);
            xyContext.stroke();
            xyContext.closePath();

            xyContext.beginPath();
            xyContext.strokeStyle = 'green';
            xyContext.lineWidth = 1;
            xyContext.moveTo(crosshairValues.xy.w, 0);
            xyContext.lineTo(crosshairValues.xy.rw, xyCanvas.height);
            xyContext.stroke();
            xyContext.closePath();
            
            let yzCanvas = document.getElementById("yzCanvas")
            //this seems to be flipped, make sure that's the case with all the data
            yzContext.clearRect(0, 0, yzCanvas.width, yzCanvas.height);
            yzContext.beginPath();
            yzContext.strokeStyle = 'red';
            yzContext.lineWidth = 1;
            //resultingHeight = Math.abs(1 - (yzCanvas.height * xySlice));
            let resultingWidth = Math.abs(yzCanvas.width * xzSlice);
            //console.log(resultingHeight)
            yzContext.moveTo(0, crosshairValues.yz.h);
            yzContext.lineTo(yzCanvas.width, crosshairValues.yz.h);
            yzContext.stroke();
            yzContext.closePath();

            yzContext.beginPath();
            yzContext.strokeStyle = 'blue';
            yzContext.lineWidth = 1;
            yzContext.moveTo(resultingWidth, 0);
            yzContext.lineTo(resultingWidth, yzCanvas.height);
            yzContext.stroke();
            yzContext.closePath(); 

        }

    })
    
    let img3 = document.getElementById("yzImg")
    img3.addEventListener("load", (e) => {
       
        if (canvasDimensions.yz.w == 0) {
            canvasDimensions.yz.w = img3.width
            canvasDimensions.yz.h = img3.height * ( voxels.z / voxels.x )
        }

        yzImgCanvas.width = canvasDimensions.yz.w
        yzImgCanvas.height = canvasDimensions.yz.h
        let scaleRatio = yzImgCanvas.width / 514 
        yzImgCanvasContext.scale(voxels.y / voxels.x * scaleRatio, voxels.z / voxels.x * scaleRatio)
        
        yzImgCanvasContext.drawImage(img3, 0, 0 )
        img3.style.display = "none"
        
        let canvas = document.getElementById("yzCanvas")
        if (!canvas){

            let canvas = document.createElement("canvas")
            canvas.id = 'yzCanvas'
            yzContext = canvas.getContext('2d')
            canvas.width = yzImgCanvas.width
            canvas.height = yzImgCanvas.height
            document.getElementById("yzQuadArea").appendChild(canvas)

            canvas.style.position = "absolute"
            canvas.style.left = yzImgCanvas.offsetLeft + "px"
            canvas.style.top = yzImgCanvas.offsetTop + "px"
            
            yzContext.clearRect(0, 0, canvas.width, canvas.height);
            yzContext.beginPath();
            yzContext.strokeStyle = 'red';
            yzContext.lineWidth = 1;
            crosshairValues.yz.h = canvas.height/2
            yzContext.moveTo(0, crosshairValues.yz.h);
            yzContext.lineTo(canvas.width, crosshairValues.yz.h);
            yzContext.stroke();
            yzContext.closePath();

            yzContext.beginPath();
            yzContext.strokeStyle = 'blue';
            yzContext.lineWidth = 1;
            crosshairValues.yz.w = canvas.width/2
            yzContext.moveTo(crosshairValues.yz.w, 0);
            yzContext.lineTo(crosshairValues.yz.w, canvas.height);
            yzContext.stroke();
            yzContext.closePath(); 
        } else {
            //Correct way to get percentage?, also hardcoded and values will need to be fetched
            let yzSlice = document.getElementById("yzSlider").value / 1081
            let xyCanvas = document.getElementById("xyCanvas")
            
            xyContext.clearRect(0, 0, xyCanvas.width, xyCanvas.height);
            xyContext.beginPath();
            xyContext.strokeStyle = 'red';
            xyContext.lineWidth = 1;
            
            xyContext.moveTo(0, crosshairValues.xy.h);
            xyContext.lineTo(xyCanvas.width, crosshairValues.xy.h);
            xyContext.stroke();
            xyContext.closePath();


            xyContext.beginPath();
            xyContext.strokeStyle = 'green';
            xyContext.lineWidth = 1;
            let resultingWidth = xyCanvas.width * yzSlice;
            xyContext.moveTo(resultingWidth, 0);
            xyContext.lineTo(resultingWidth, xyCanvas.height);
            xyContext.stroke();
            xyContext.closePath();

            resultingWidth = xzCanvas.width * yzSlice;
            xzContext.clearRect(0, 0, xzCanvas.width, xzCanvas.height);
            xzContext.beginPath();
            xzContext.strokeStyle = 'red';
            xzContext.lineWidth = 1;
            xzContext.moveTo(0, crosshairValues.xz.h);
            xzContext.lineTo(xzCanvas.width, crosshairValues.xz.h);
            xzContext.stroke();
            xzContext.closePath();

            xzContext.beginPath();
            xzContext.strokeStyle = 'blue';
            xzContext.lineWidth = 1;
            xzContext.moveTo(resultingWidth, 0);
            xzContext.lineTo(resultingWidth, xzCanvas.height);
            xzContext.stroke();
            xzContext.closePath();
        }
    }) 

    document.getElementById("xzSlider").addEventListener("input", (event) => {
        let fname = window.bivws.ModalPath.XZ + document.getElementById("xzSlider").value.padStart(4, '0') + '.png';
        document.getElementById("xzImg").src = fname
    })

    $( "#xySlider" ).on("input change", function() {
        let val = $(this).val();
        changeImgSrc(window.bivws.ModalPath.XY, val, "#xyImg");
        $( "#xySliderValue" ).text(val);
        window.bivws.CurSliderVal.xy = parseInt(val);
    });

    $( "#yzSlider" ).on("input change", function() {
        let val = $(this).val();
        changeImgSrc(window.bivws.ModalPath.YZ, val, "#yzImg");
        $( "#yzSliderValue" ).text(val);
        window.bivws.CurSliderVal.xz = parseInt(val);
    });
    
    //Will need to retroactively resize canvases and redraw lines
    window.addEventListener("resize", (e) => [
        console.log("resized")
        //select all canvases and resize them
        //we will need to know the previous size of the canvas, and the final size to figure out the percentage diff
    ])

    $('.modradios input[type=radio]').click( function(){
        let modal = this.value.toUpperCase();
        if (modal === "BR") {
            window.bivws.ModalPath = window.bivws.MODALBRPATH;
        }
        else if (modal === "FL") {
            window.bivws.ModalPath = window.bivws.MODALFLPATH;
        }
        changeModality();
    });

    function changeImgSrc(modalPath, val, elmId) {
        let fname = modalPath + val.padStart(4, '0') + '.png';
        $( elmId ).attr("src", fname);
    }
    //This doesn't work, we'll expand upon this once BR works correctly
    function changeModality() {
        // #xyImg and #xySliderValue;
        let val = $( "#xySliderValue" ).text();
        changeImgSrc(window.bivws.ModalPath.XY, val, "#xyImg");
        // #xzImg and #xzSliderValue;
        val = $( "#xzSliderValue" ).text();
        changeImgSrc(window.bivws.ModalPath.XZ, val, "#xzImg");
        // #yzImg and #yzSliderValue;
        val = $( "#yzSliderValue" ).text();
        changeImgSrc(window.bivws.ModalPath.YZ, val, "#yzImg");
    }

    //@DAVID
    //annote button -- plus some starter code
    document.getElementById("annotateXY").addEventListener("click", () => {
        //add stop and save buttons
        //Add Canvas
        let canvas = document.createElement("canvas")
        canvas.id = 'xyAnnotateCanvas'
        let context = canvas.getContext('2d')
        canvas.width = canvasDimensions.xy.w
        canvas.height = canvasDimensions.xy.h
        document.getElementById("xyQuadArea").appendChild(canvas)
        canvas.style.position = "absolute"
        canvas.style.left = xyImgCanvas.offsetLeft + "px"
        canvas.style.top = xyImgCanvas.offsetTop + "px"
        //Text/Ruler/brushstroke

    })
} ); //end jquery document ready



document.addEventListener("DOMContentLoaded", (event) => {
    //webGLStart(); turned off during 2d development
    console.log("events initalized")
    
}) 