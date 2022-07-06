import bsCustomFileInput from 'bs-custom-file-input';
import { convertImageBlob } from '../lib/convert';
import { ImageMode, ImageModeUtil, OutputMode } from '../lib/enums';
import { saveAs } from 'file-saver';
import { useArrayState, useBooleanState } from 'react-use-object-state';
import { createRoot } from 'react-dom/client';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { Button, Col, Form, FormLabel } from 'react-bootstrap';

function RowWithLabel({ labelText, labelFor, children }) {
    return <Form.Row className="mb-3">
        <Col md={3}>
            <FormLabel htmlFor={labelFor}>{labelText}</FormLabel>
        </Col>
        <Col md={9}>
            {children}
        </Col>
    </Form.Row>;
}

function FileInputRow({ setFileList, numFiles }) {
    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFileList(Array.from(e.target.files));
    }, [setFileList]);
    return <RowWithLabel labelText="Image file" labelFor="customFile">
        <div className="custom-file">
                <input onChange={onChange} multiple type="file" className="custom-file-input" id="customFile"/>
                <label className="custom-file-label" htmlFor="customFile">{numFiles} file(s) selected.</label>
        </div>
    </RowWithLabel>;
}

function FileName({ name, upsert, index }) {
    const onChange = useCallback((e) => {
        upsert(e.target.value, index);
    }, [ upsert, index ]);
    return <Form.Control
        onChange={onChange}
        type="text"
        name={"name" + index}
        value={name}
        placeholder={`Variable name of image ${index+1}`}
    />;
}

function FileNames({ names, upsert }) {
    if(names.length == 0)
        return null;
    return <RowWithLabel labelText="File name(s)" labelFor="name0">
        {names.map((name, i) => <FileName index={i} key={i} name={name} upsert={upsert}/>)}
    </RowWithLabel>;
}

const modeKeys = Object.keys(ImageMode).filter((v) => (isNaN(v as any) && !v.startsWith("ICF")));

const ColorFormatOptions = memo(() => {
    return <>{modeKeys.map(mode => (
        <option key={mode} value={ImageMode[mode]}>{mode}</option>
    ))}</>;
});

function ColorFormat({ colorFormat, setColorFormat }) {
    const onChange = useCallback((e) => {
        setColorFormat(parseInt(e.target.value));
    }, []);
    return <RowWithLabel labelText="Color format" labelFor="cf">
        <Form.Control as="select" name="cf" value={colorFormat} onChange={onChange}>
            <ColorFormatOptions/>
        </Form.Control>
        <p className="text-mute">
            <strong>Alpha byte</strong> Add a 8 bit Alpha value to every pixel<br/>
            <strong>Chroma keyed</strong> Make LV_COLOR_TRANSP (lv_conf.h) pixels to transparent
        </p>
    </RowWithLabel>;
}

function OutputFormat({ colorFormat, outputFormat, setOutputFormat }) {
    const onChange = useCallback((e) => {
        setOutputFormat(e.target.value);
    }, []);
    const isTrueColor = (colorFormat == ImageMode.CF_TRUE_COLOR_ALPHA ||
        colorFormat == ImageMode.CF_TRUE_COLOR ||
        colorFormat == ImageMode.CF_TRUE_COLOR_CHROMA ||
        colorFormat == ImageMode.CF_RGB565A8);
    return <RowWithLabel labelText="Output format" labelFor="format">
        <Form.Control as="select" name="format" value={outputFormat} onChange={onChange}>
            <option value="c_array">C array</option>
            {!isTrueColor && <option value="bin">Binary</option>}
            {isTrueColor && <>
                <option value="bin_332">Binary RGB332</option>
                <option value="bin_565">Binary RGB565</option>
                <option value="bin_565_swap">Binary RGB565 Swap</option>
                <option value="bin_888">Binary RGB888</option>
            </>}
        </Form.Control>
    </RowWithLabel>;
}

function ExtraOptions({ canChangeEndian, dither, setDither, bigEndian, setBigEndian }) {
    const onDitherChange = useCallback(e => setDither(e.target.checked), [ setDither ]);
    const onEndianChange = useCallback(e => setBigEndian(e.target.checked), [ setBigEndian ]);
    return <RowWithLabel labelFor={undefined} labelText="Options">
        <Form.Check 
            custom
            value={dither}
            onChange={onDitherChange}
            type="checkbox"
            id={"dith-checkbox"}
            label="Dither images (can improve quality)"
        />
        <Form.Check 
            custom
            disabled={!canChangeEndian}
            value={bigEndian}
            onChange={onEndianChange}
            type="checkbox"
            id={"endian-checkbox"}
            label="Output in big-endian format"
        />
    </RowWithLabel>;
}

function tryParsingImageData(url: string): Promise<{w:number;h:number;}|null> {
    return new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve({ w: image.width, h: image.height });
        image.onerror = () => resolve(null);
        image.src = url;
    });
}

function App() {
    const [ fileList, setFileList ] = useState<File[]>([]);
    const [ colorFormat, setColorFormat ] = useState<ImageMode>(ImageMode.CF_TRUE_COLOR);
    const [ outputFormat, setOutputFormat ] = useState("c_array");
    const names = useArrayState([]);
    const dither = useBooleanState(false);
    const bigEndian = useBooleanState(false);
    useEffect(() => {
        names.setState(fileList.map(file => ""));
    }, [ fileList ]);
    const [ isConverting, setIsConverting ] = useState(false);
    const doConvert = useCallback(() => {
        setIsConverting(true);
        const performConversion = async() => {
            for(var i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                if(file) {
                    const reader = new FileReader();
                    await new Promise<void>((resolve, reject) => {
                        const outputType = outputFormat;
                        let outputMode, binaryFormat;
                        const requestedCf = colorFormat;
                        if(outputType == "c_array")
                            outputMode = OutputMode.C;
                        else {
                            outputMode = OutputMode.BIN;
                            const needBinaryFormat = ImageModeUtil.isTrueColor(requestedCf);
                            if(needBinaryFormat) {
                                const binFormatMap = {
                                    "bin_332": ImageMode.ICF_TRUE_COLOR_ARGB8332,
                                    "bin_565": ImageMode.ICF_TRUE_COLOR_ARGB8565,
                                    "bin_565_swap": ImageMode.ICF_TRUE_COLOR_ARGB8565_RBSWAP,
                                    "bin_888": ImageMode.ICF_TRUE_COLOR_ARGB8888
                                }
                                binaryFormat = binFormatMap[outputType];
                                if(typeof binaryFormat == 'undefined')
                                    throw new Error("Binary format not found: " + outputType);
                            }
                        }
                        async function doConvert(blob, overrideWidth?: number, overrideHeight?: number) {
                            let imageName: string = names.state[i];
                            if (imageName == "") {
                                imageName = file.name.split('.')[0];
                            }
        
                            const swapEndian = outputMode == OutputMode.C && bigEndian.state;
                            const imageString = await convertImageBlob(blob, {
                                cf: requestedCf,
                                outName: imageName,
                                swapEndian: swapEndian,
                                outputFormat: outputMode,
                                binaryFormat,
                                overrideWidth,
                                overrideHeight
                            });
                            console.log(imageString);
                            const newBlob = new Blob([ imageString ], {
                                type: outputMode == OutputMode.BIN ? "binary/octet-stream" : "text/x-c;charset=utf-8"
                            });
                            saveAs(newBlob, imageName + "." + (outputMode == OutputMode.BIN ? "bin" : "c"));
                            resolve();
                        }
                        if(ImageMode[colorFormat].startsWith("CF_RAW")) {
                            reader.readAsArrayBuffer(file);
                            reader.onload = async function(e) {
                                console.log("loaded");
                                const buf = e.target.result as ArrayBuffer;
                                const blobUrl = URL.createObjectURL(new Blob([buf]));
                                const overrideInfo = await tryParsingImageData(blobUrl);
                                doConvert(new Uint8Array(buf), overrideInfo?.w, overrideInfo?.h);
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
                                image.src = e.target.result as string;
                            }
                            reader.readAsDataURL(file);
                        }
                    });
                }
            }
            setIsConverting(false);
        };
        performConversion();
    }, [ dither.state, bigEndian.state, setIsConverting, fileList, names, colorFormat, outputFormat ]);
    return <Col md={{ span: 9 }}>
        <Form encType="multipart/form-data" name="img_conv">
            <FileInputRow setFileList={setFileList} numFiles={fileList.length}/>
            <FileNames names={names.state} upsert={names.upsertAt}/>
            <ColorFormat colorFormat={colorFormat} setColorFormat={setColorFormat}/>
            <OutputFormat colorFormat={colorFormat} outputFormat={outputFormat} setOutputFormat={setOutputFormat}/>
            <ExtraOptions canChangeEndian={outputFormat == "c_array"} dither={dither.state} setDither={dither.setState} bigEndian={bigEndian.state} setBigEndian={bigEndian.setState}/>
            <Form.Group>
                <Button disabled={isConverting} onClick={doConvert} variant="primary" as="input" type="button" value="Convert" name="submit" id="convert-button"/>
            </Form.Group>
        </Form>
    </Col>;
}

$(document).ready(function () {
    bsCustomFileInput.init();
    createRoot(document.querySelector(".react-app-container")).render(<App/>);
});

/* FIXME: temporary hack to fix setImmediate issue */
/* @ts-ignore */
window.setImmediate = (fn) => setTimeout(fn, 0);
