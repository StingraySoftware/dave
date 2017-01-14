#!/bin/bash

cd src/main/js/electron

npm run build

cd -

\cp setup/config/deply_config.js build/DAVEApp-linux-x64/resources/app/config.js
\cp -r src/main/resources src/main/python build/DAVEApp-linux-x64/resources
\cp -r setup/environment.yml build/DAVEApp-linux-x64/resources
