#!/bin/bash
#
# This script will run the tests for the project and build the exexutable
# packages. It will also publish the packages to a given directory or set of
# directories. If multiple directories are provided, the packages will be copied
# to all of them.
#
# The script should be executed in the top-level directory of the Git repo.
#
# The following variables control the script:
#
# PUBLISH_ALL: Build and publish packages for all supported OSs
# PUBLISH_LINUX: Build and publish packages for Linux (64-bit)
# PUBLISH_MACOS: Build and publish packages for Mac OS X
# DIST_DIRS: Space separated list of directories where the packages shall be
#            copied.
#

rm -rf work
source setup/setup.bash

echo "Running Python unit tests"
echo "========================="
echo
python -m pytest src/test/python

test_result=$?

echo "Result of tests: $test_result"

if [ ! $test_result -eq "0" ]; then exit $test_result; fi

function publish_file {
  FILE=$1
  echo "DIST_DIRS=$DIST_DIRS"
  for DIR in $DIST_DIRS; do
    if [ ! -d $DIR ]; then
      mkdir -p $DIR || exit 1  # exit if this fails
    fi
    echo "Publishing $FILE to $DIR"
    cp $FILE $DIR
  done
}

if ! [ -z "$PUBLISH_ALL" -a -z "$PUBLISH_LINUX" ]; then
  echo "Building Linux x64 package"
  echo "========================="

  setup/build_linux-x64.bash
  publish_file build/DAVEApp-linux-x64.zip
fi

if ! [ -z "$PUBLISH_ALL" -a -z "$PUBLISH_MACOS" ]; then
  echo "Building OS X package"
  echo "========================="

  setup/build_MacOS.bash
  publish_file build/DAVEApp-darwin-x64.zip
fi

echo "Done"
