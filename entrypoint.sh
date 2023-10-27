#!/usr/bin/env bash

if [[ -z "$@" ]]; then
    exec /bin/bash
else
    lv_img_conv.js "$@"
fi

