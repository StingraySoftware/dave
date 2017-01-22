#!/bin/bash

BUILD_NAME=DAVEApp-darwin-x64
BUILD_FOLDER=build/$BUILD_NAME

rm -rf $BUILD_FOLDER
rm -f build/$BUILD_NAME.zip

cd src/main/js/electron
npm run build --platform=darwin --arch=x64
cd -

\cp setup/config/deply_darwin_config.js $BUILD_FOLDER/DAVEApp.app/Contents/Resources/app/config.js
\cp -r src/main/resources $BUILD_FOLDER/resources
\cp -r src/main/python $BUILD_FOLDER/python
\cp -r work/stingray/requirements.txt $BUILD_FOLDER/python
rm -f $BUILD_FOLDER/resources/python/*.log
rm -f $BUILD_FOLDER/resources/python/uploadeddataset/*
\cp -r setup/environment.yml $BUILD_FOLDER

cd build
zip -r $BUILD_NAME.zip $BUILD_NAME
cd -

echo "MacOS Build Success!"
