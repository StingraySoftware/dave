#!/bin/bash

cd src/main/js/electron

npm run build

cd -

\cp src/main/resources/config/config.js build/DAVEApp-linux-x64/resources/app/config.js
