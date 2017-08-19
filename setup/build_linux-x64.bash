#!/bin/bash

BUILD_NAME=DAVEApp-linux-x64
BUILD_FOLDER=build/$BUILD_NAME

#Gets the date from git of latest commit on local branch
COMMIT_HASH=$(git log -n 1 --pretty=format:"%H")
BUILD_DATE=$(git show -s --format=%ci $COMMIT_HASH)
if [[ -z "${BUILD_NUMBER}" ]]; then
  BUILD_VERSION="$BUILD_DATE-$COMMIT_HASH"
else
  BUILD_VERSION="$JOB_NAME-$BUILD_NUMBER"
fi

rm -rf $BUILD_FOLDER
rm -f build/$BUILD_NAME.zip

cd src/main/js/electron
npm run build-linux
cd -

\cp setup/config/deply_linux_config.js $BUILD_FOLDER/resources/app/config.js
\cp -r src/main/resources src/main/python $BUILD_FOLDER/resources
\cp -r work/stingray/requirements.txt $BUILD_FOLDER/resources/python
rm -f $BUILD_FOLDER/resources/python/*.log
rm -f $BUILD_FOLDER/resources/python/uploadeddataset/*
\cp -r setup/environment.yml $BUILD_FOLDER/resources
echo "$BUILD_DATE" > $BUILD_FOLDER/resources/resources/version.txt
echo "BUILD_VERSION='$BUILD_VERSION';" > $BUILD_FOLDER/resources/resources/static/scripts/version.js
echo "COMMIT_HASH='$COMMIT_HASH';" >> $BUILD_FOLDER/resources/resources/static/scripts/version.js

cd build
zip -r $BUILD_NAME.zip $BUILD_NAME
cd -

echo "Linux-x64 Build Success! Version: $BUILD_VERSION , Date: $BUILD_DATE"
