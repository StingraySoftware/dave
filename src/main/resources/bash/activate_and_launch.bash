#!/bin/bash

function stopServer {
	#Kills Python server and exits
	echo "Sending kill to Python -> $python_pid"
	kill -s 9 $python_pid
	exit 0
}

sendError()
{
	#Notifies Node.js that create_env script crashed
	if [ "$#" -gt "0" ];then
		echo "$1"
		echo "@ERROR@|$1|"
		if [ "$#" -gt "1" ];then
			if [[ ! -z "$2" ]];then
				rm -rf $2
			fi
		fi
	fi
	exit 10
}

checkReturnCode()
{
	#Checks if return code is an error code and sends error to Node.js
	if [[ $1 -ne 0 ]] ; then
		sendError "$2" "$3"
	fi
}

# Activate environment progress notification
echo "@PROGRESS@|5|Checking previous version|"

# Determine the directory containing this script
if [[ -n $BASH_VERSION ]]; then
		_SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
else
		sendError "Only bash supported"
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

echo "@PROGRESS@|70|Activating Python environment|"
echo "Activating Python environment"
ACTIVATE_CMD="$ENVDIR/miniconda/bin/activate"
source $ACTIVATE_CMD dave
checkReturnCode $? "Can´t activate Python environment, error $?"

#Installing Stingray
PYTHON_FOLDER=$RES_DIR/python
echo "@PROGRESS@|80|Installing Python dependencies|"
echo "Installing Python dependencies"
cd $PYTHON_FOLDER
pip install -r requirements.txt
checkReturnCode $? "Can´t install Python dependencies, error $?"

# LAUNCH PYTHON SERVER AND PREPARE FURTHER PROCESS KILL
echo "Launching Python Server"
echo "@PROGRESS@|90|Launching Python Server|"
python server.py $ENVDIR . 5000 $VERSION & >> $ENVDIR/flaskserver.log 2>&1
python_pid=$!
trap stopServer SIGHUP SIGINT SIGTERM SIGKILL
cd -

echo "@PROGRESS@|100|Python Server ready|"
wait $python_pid

exit $?
