#!/bin/bash

function stopServer {
	#Kills Python server and exits
	echo "Sending kill to Python -> $python_pid"
	kill -s 9 $python_pid
	exit 0
}
trap stopServer SIGHUP SIGINT SIGTERM SIGKILL

# Determine the directory containing this script
if [[ -n $BASH_VERSION ]]; then
		_SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
else
    echo "Only bash supported .."
    exit 1
fi

DIR=$_SCRIPT_FOLDER/../../../..
OLD_PWD=$(pwd)
cd $DIR
DIR=$(pwd)
cd -

ENVDIR=${DIR}/work

if [ ! -e $ENVDIR ]; then
	echo "Please run ( source src/main/resources/bash/setup_dev_env.bash ) first to setup and install DAVE environment before continue."
	exit 1
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
	# Mac OSX
	#This is for MagicFile but only applies to macosx
	if [ ! -f /usr/local/bin/brew ]; then
    echo "Please install HomeBrew before continue."
		echo "Run this HomeBrew installation command on a terminal and relanch DAVE:"
		echo '/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"'
		exit 1
	fi

	echo "Installing HomeBrew and LibMagic"
	/usr/local/bin/brew install libmagic
fi

echo Activating Python environment
ACTIVATE_CMD="$DIR/work/miniconda/bin/activate dave"
. $ACTIVATE_CMD

#Installing Stingray
STINGRAY_FOLDER=$DIR/work/stingray
echo Installing Stingray
cd $STINGRAY_FOLDER
pip install -r requirements.txt
cd -

# LAUNCH PYTHON SERVER
echo Launching Python Server
python $DIR/src/main/python/server.py . . & >> /tmp/flaskserver.log 2>&1
python_pid=$!

wait $python_pid

exit $?
