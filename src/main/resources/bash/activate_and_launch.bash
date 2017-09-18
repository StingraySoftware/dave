#!/bin/bash

function stopServer {
	#Kills Python server and exits
	echo "Sending kill to Python -> $python_pid"
	kill -s 9 $python_pid
	exit 0
}

# Determine the directory containing this script
if [[ -n $BASH_VERSION ]]; then
		_SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
else
    echo "Only bash supported."
    exit 10
fi

RES_DIR=$_SCRIPT_FOLDER/../..
OLD_PWD=$(pwd)
cd $RES_DIR
RES_DIR=$(pwd)
cd -

ENVDIR=$HOME/.dave
echo "Python Environment folder: $ENVDIR"

#Check DAVE environment version
VERSION_FILE=$ENVDIR/version.txt
VERSION=$(cat $RES_DIR/resources/version.txt)
if [ -e $VERSION_FILE ]; then
	if [[ $(cat $VERSION_FILE) != $VERSION ]]; then
		echo "Wrong DAVE Version found, updating Python Environment"
		rm -rf $ENVDIR
	else
		echo "DAVE Version matches the Python Environment Version"
	fi
else
	#If no version file found, sure is a wrong DAVE version
	echo "Wrong DAVE Version, updating Python Environment"
	rm -rf $ENVDIR
fi

#Creates environment if not found
if [ ! -e $ENVDIR ]; then
	echo "Installing Python Environment"
	SETUP_CMD="$RES_DIR/resources/bash/create_env.bash"
	. $SETUP_CMD
fi

echo "Activating Python environment"
ACTIVATE_CMD="$ENVDIR/miniconda/bin/activate"
source $ACTIVATE_CMD dave

#Installing Stingray
PYTHON_FOLDER=$RES_DIR/python
echo Installing Python dependencies
cd $PYTHON_FOLDER
pip install -r requirements.txt

# LAUNCH PYTHON SERVER AND PREPARE FURTHER PROCESS KILL
echo "Launching Python Server"
python server.py $ENVDIR . 5000 $VERSION & >> $ENVDIR/flaskserver.log 2>&1
python_pid=$!
trap stopServer SIGHUP SIGINT SIGTERM SIGKILL
cd -

wait $python_pid

exit $?
