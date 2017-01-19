#!/bin/bash

BUILD_NAME=DAVEApp-linux-x64
BUILD_FOLDER=build/$BUILD_NAME

rm -rf $BUILD_FOLDER
rm -f build/$BUILD_NAME.zip

cd src/main/js/electron
npm run build --platform=linux --arch=x64
cd -

\cp setup/config/deply_linux_config.js $BUILD_FOLDER/resources/app/config.js
\cp -r src/main/resources src/main/python $BUILD_FOLDER/resources
\cp -r setup/environment.yml $BUILD_FOLDER/resources

cd build
zip -r $BUILD_NAME.zip $BUILD_NAME
cd -
