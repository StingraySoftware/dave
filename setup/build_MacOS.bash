#!/bin/bash

BUILD_NAME=DAVEApp-darwin-x64
BUILD_FOLDER=build/$BUILD_NAME

rm -rf $BUILD_FOLDER
rm -f build/$BUILD_NAME.zip

cd src/main/js/electron
npm run build-darwin
cd -

\cp setup/config/deply_darwin_config.js $BUILD_FOLDER/DAVEApp.app/Contents/Resources/app/config.js
mkdir $BUILD_FOLDER/DAVEApp.app/dave
\cp -r src/main/resources $BUILD_FOLDER/DAVEApp.app/dave/resources
\cp -r src/main/python $BUILD_FOLDER/DAVEApp.app/dave/python
\cp -r work/stingray/requirements.txt $BUILD_FOLDER/DAVEApp.app/dave/python
rm -f $BUILD_FOLDER/DAVEApp.app/dave/python/*.log
rm -f $BUILD_FOLDER/DAVEApp.app/dave/python/uploadeddataset/*
\cp -r setup/environment.yml $BUILD_FOLDER/DAVEApp.app/dave/

cd build
zip -r $BUILD_NAME.zip $BUILD_NAME
cd -

echo "MacOS Build Success!"
