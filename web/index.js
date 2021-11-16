import bsCustomFileInput from 'bs-custom-file-input';
import { convertImageBlob } from '../lib/convert';
import { ImageMode, ImageModeUtil, OutputMode, BINARY_FORMAT_PREFIX } from '../lib/enums';
import { saveAs } from 'file-saver';
import { resolve } from 'path';
import { rejects } from 'assert';

function updateNameTextboxes() {
    const input = $("#customFile")[0];
    const $nameContainer = $(".name-container");
    const numExistingFields = $nameContainer.children().length;
    const totalLength = Math.max(numExistingFields, input.files.length);
    for(var i = 0; i < totalLength; i++) {
        if(i >= numExistingFields)
            $nameContainer.append(`<input type="text" name="name${i}" id="name${i}" class="form-control" placeholder="Variable name of image ${i+1}" style="height:unset">`);
        else if(i >= input.files.length) {
            $nameContainer.get(0).removeChild($nameContainer.children().get(i));
        }
    }
    $(".name-row").css("display", input.files.length > 0 ? "" : "none");
}

function updateListedBinaryFormats() {
    const needBinaryFormat = ImageModeUtil.isTrueColor($("#cf").val());
    $("#format").children("option").each(function() {
        if(!$(this).val().startsWith("bin")) {
            /* bail out if not binary format */
            return;
        }
        if($(this).val().startsWith("bin_")) {
            /* has color code afterward */
            $(this).prop("disabled", !needBinaryFormat);
            $(this).prop("hidden", !needBinaryFormat);
        } else {
            /* has no color code */
            $(this).prop("disabled", needBinaryFormat);
            $(this).prop("hidden", needBinaryFormat);
        }
    });
    /* Don't allow using disabled options */
    if($("#format option:selected").prop("disabled"))
        $("#format").val("c_array");
}

$(document).ready(function () {
    bsCustomFileInput.init();
    updateNameTextboxes();
    updateListedBinaryFormats();
});

$("#customFile").change(updateNameTextboxes);
$("#cf").on("change", updateListedBinaryFormats);

$("#format").on("change", function() {
    const needsDisable = $("#format").val() != "c_array";
    if(needsDisable)
        $("endian-checkbox").prop("checked", false);
    $("#endian-checkbox").prop("disabled", needsDisable);
})

$("#convert-button").on("click", async() => {
    $("#convert-button").attr("disabled", true);
    /** @type {HTMLInputElement} */
    const input = $("#customFile")[0];
    for(var i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        if(file) {
            const reader = new FileReader();
            await new Promise((resolve, reject) => {
                const outputType = $("#format").val();
                let outputMode, binaryFormat;
                const requestedCf = ImageMode[$("#cf").val()];
                if(outputType == "c_array")
                    outputMode = OutputMode.C;
                else {
                    outputMode = OutputMode.BIN;
                    const needBinaryFormat = ImageModeUtil.isTrueColor(requestedCf);
                    if(needBinaryFormat) {
                        const binFormatRequest = BINARY_FORMAT_PREFIX + outputType.substring(4).toUpperCase();
                        binaryFormat = ImageMode[binFormatRequest];
                        if(typeof binaryFormat == 'undefined')
                            throw new Error("Binary format not found: " + binFormatRequest);
                    }
                }
                async function doConvert(blob) {
                    let imageName = $("#name" + i).val();
                    if (imageName == "") {
                        imageName = file.name.split('.')[0];
                    }

                    const swapEndian = outputMode == OutputMode.C && document.querySelector("#endian-checkbox").checked;
                    const imageString = await convertImageBlob(blob, { cf: requestedCf, imageName: imageName, outName: imageName, swapEndian: swapEndian, outputFormat: outputMode, binaryFormat });
                    console.log(imageString);
                    var blob = new Blob([ imageString ], {
                        type: outputMode == OutputMode.BIN ? "binary/octet-stream" : "text/x-c;charset=utf-8"
                    });
                    saveAs(blob, imageName + "." + (outputMode == OutputMode.BIN ? "bin" : "c"));
                    resolve();
                }
                if($("#cf").val().startsWith("CF_RAW")) {
                    reader.readAsArrayBuffer(file);
                    reader.onload = function(e) {
                        console.log("loaded");
                        /** @type {ArrayBuffer} */
                        const buf = e.target.result;
                        doConvert(new Uint8Array(buf));
                    }
                } else {
                    reader.onload = function(e) {
                        var image = new Image();
                        image.onload = function() {
                            console.log("loaded");
                            doConvert(image);
                        };

                        image.onerror = function(e) {
                            reject(e);
                        };
                        image.src = e.target.result;
                    }
                    reader.readAsDataURL(file);
                }
            });
        }
    }
    $("#convert-button").removeAttr("disabled");
});

/* FIXME: temporary hack to fix setImmediate issue */
window.setImmediate = (fn) => setTimeout(fn, 0);
