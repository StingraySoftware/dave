#!/bin/bash

BUILD_NAME=DAVEApp-darwin-x64
BUILD_FOLDER=build/$BUILD_NAME

#Gets the date from git of latest commit on local branch
COMMIT_HASH=$(git log -n 1 --pretty=format:"%H")
BUILD_DATE=$(git show -s --format=%ci $COMMIT_HASH)
if [[ -z "${BUILD_NUMBER}" ]]; then
  BUILD_VERSION=$BUILD_DATE
else
  BUILD_VERSION=$BUILD_NUMBER
fi


rm -rf $BUILD_FOLDER
rm -f build/$BUILD_NAME.zip

cd src/main/js/electron
# Construct a version to be whatever is in the package.json + the build info. Revert to original version first in case this script is run twice.
git checkout -- package.json
NPM_VERSION=$(cat package.json | jq '.version' | sed 's/"//g')"-"$(echo $BUILD_VERSION | sed 's/[_-+ ]//g')
# Update the version in the package.json. 
cat package.json | jq --arg VERSION $NPM_VERSION 'to_entries | map(if .key == "version" then . + {"value": $VERSION} else . end ) | from_entries' > package.json.tmp
mv package.json.tmp package.json
npm run build-darwin
retVal=$?
if [[ retVal -ne 0 ]] ; then
        rm $MINICONDA
        echo "npm build failed"
        return 1
fi

cd -

\cp setup/config/deply_darwin_config.js $BUILD_FOLDER/DAVEApp.app/Contents/Resources/app/config.js
mkdir $BUILD_FOLDER/DAVEApp.app/dave
\cp -r src/main/resources $BUILD_FOLDER/DAVEApp.app/dave/resources
\cp -r src/main/python $BUILD_FOLDER/DAVEApp.app/dave/python
\cp -r work/stingray/requirements.txt $BUILD_FOLDER/DAVEApp.app/dave/python
rm -f $BUILD_FOLDER/DAVEApp.app/dave/python/*.log
rm -f $BUILD_FOLDER/DAVEApp.app/dave/python/uploadeddataset/*
\cp -r setup/environment.yml $BUILD_FOLDER/DAVEApp.app/dave/
echo "$BUILD_DATE" > $BUILD_FOLDER/DAVEApp.app/dave/resources/version.txt
echo "BUILD_VERSION='$BUILD_VERSION';" > $BUILD_FOLDER/DAVEApp.app/dave/resources/static/scripts/version.js

cd build
zip -r $BUILD_NAME.zip $BUILD_NAME
cd -

echo "MacOS Build Success! Version: $BUILD_VERSION , Date: $BUILD_DATE"
