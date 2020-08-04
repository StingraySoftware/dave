#!/bin/bash

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
	sleep 1
	exit 10
}

checkReturnCode()
{
	#Checks if return code is an error code and sends error to Node.js
	if [[ $1 -ne 0 ]] ; then
		sendError "$2" "$3"
	fi
}

# Determine the directory containing this script
if [[ -n $BASH_VERSION ]]; then
		_SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
else
		sendError "Only bash supported"
fi

# Activate environment progress notification
echo "@PROGRESS@|10|Installing LibMagic|"

#Check for LibMagic on Mac first for avoid user to wait all downloads if this crash
if [[ "$OSTYPE" == "darwin"* ]]; then
	# Mac OSX

	#This is for MagicFile but only applies to macosx
	if [ ! -f /usr/local/bin/brew ]; then
		# HomeBrew is not installed
		if [ -f /opt/local/bin/port ]; then
			# MacPorts is installed
			libmagic_lines_count=`/opt/local/bin/port echo installed 2>/dev/null | grep libmagic | wc -l`
			if [[ $libmagic_lines_count -eq 0 ]]; then
				# LibMagic not installed with MacPorts

				if [ "$(id -u)" != "0" ]; then
					# We don't have administrator rights, suggest how to proceed
					echo "=========================================================================="
          echo "LibMagic is required. There are three available options to continue:"
					echo "=========================================================================="
					echo "|"
					echo "|  RECOMMENDED: Install LibMagic by yourself running this MacPorts command on the terminal and relanch DAVE:"
					echo "|      sudo /opt/local/bin/port install libmagic"
					echo "|"
					echo "|  - Or relaunch DAVE as root running this command on the terminal:"
          echo "|      sudo DAVEApp.app/Contents/MacOS/DAVEApp"
					echo "|"
					echo "|   NOTE: Copy Paste is disabled but you can Drag & Drop selected text on the terminal"
					echo "|"
					echo "=========================================================================="
          sendError "LibMagic is required, read the logs to proceed"

        else
          # If we have administrator rights just install LibMagic
          echo "Installing LibMagic with MacPorts"
					PORT_OUTPUT="$(sudo /opt/local/bin/port install file 2>&1)"
					PORT_INSTALL_STATUS=$?
					if [[ $PORT_INSTALL_STATUS -ne 0 ]] ; then
						echo $PORT_OUTPUT
						sendError "Can´t install LibMagic using MacPorts, read the logs to proceed"
					fi
				fi

			else
				# LibMagic already installed with MacPorts
				echo "LibMagic already installed with MacPorts"
			fi
    else
				# No MacPorts or HomeBrew is installed
				echo "=========================================================================="
				echo "Please install HomeBrew or MacPorts before continue."
				echo "=========================================================================="
				echo "|"
				echo "|	 RECOMMENDED: Run this HomeBrew installation command on a terminal and relanch DAVE:"
				echo '|	   /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"'
				echo "|"
				echo "|  Or install MacPorts with this guide:"
				echo '|    https://www.macports.org/install.php'
				echo "|"
				echo "|   NOTE: Copy Paste is disabled but you can Drag & Drop selected text on the terminal"
				echo "|"
				echo "=========================================================================="
				sendError "HomeBrew or MacPorts required"
    fi
	else
		# HomeBrew is installed, execute brew install and get the output and return code
		libmagic_lines_count=`/usr/local/bin/brew list 2>/dev/null | grep libmagic | wc -l`
		if [[ $libmagic_lines_count -eq 0 ]]; then
			echo "Installing LibMagic with HomeBrew"
			BREW_OUTPUT="$(/usr/local/bin/brew install libmagic 2>&1)"
			BREW_INSTALL_STATUS=$?
			if [[ $BREW_INSTALL_STATUS -ne 0 ]] ; then
				echo $BREW_OUTPUT
				sendError "Can´t install LibMagic using HomeBrew, read the logs to proceed"
			fi
		else
			# LibMagic already installed with HomeBrew
			echo "LibMagic already installed with HomeBrew"
		fi
	fi
fi

# Install in directory work in the top-level dir in the project
echo "@PROGRESS@|15|Creating Python Environment folder|"
DIR=$_SCRIPT_FOLDER/../..
WORKDIR=$HOME/.dave

if [ ! -e $WORKDIR ]; then
	echo "Creating Python Environment folder: $WORKDIR"
	mkdir $WORKDIR
fi

# normalize dir
OLD_PWD=$(pwd)
cd $DIR
DIR=$(pwd)
cd -

echo "Installing in $WORKDIR"
echo "@PROGRESS@|20|Downloading miniconda|"

# Install miniconda
MINICONDA=$WORKDIR/miniconda.sh
if [ ! -e $MINICONDA ] ; then

		if [[ "$OSTYPE" == "linux-gnu" ]]; then
			#Linux
			echo "Downloading miniconda for Linux-x86_64..."
			MINICONDA_URL_LINUX=https://repo.continuum.io/miniconda/Miniconda3-latest-Linux-x86_64.sh
			wget --quiet $MINICONDA_URL_LINUX -O $MINICONDA

		elif [[ "$OSTYPE" == "darwin"* ]]; then
      # Mac OSX
			echo "Downloading miniconda for MacOSX-x86_64..."
			MINICONDA_URL_MACOS=https://repo.continuum.io/miniconda/Miniconda2-4.2.12-MacOSX-x86_64.sh
			curl -L $MINICONDA_URL_MACOS -o "$MINICONDA"

		else
      # Unknown OS.
			sendError "Error downloading miniconda: Unsupported OS Platform" $WORKDIR
		fi
fi

#Check Miniconda download result
checkReturnCode $? "Can´t download MINICONDA, error $?" $WORKDIR
chmod u+x $MINICONDA

#Install Miniconda
echo "@PROGRESS@|35|Installing miniconda|"
INSTALL_DIR=$WORKDIR/miniconda
if [ ! -e $INSTALL_DIR ]; then
  echo "Installing miniconda"
  $MINICONDA -b -p $INSTALL_DIR
	checkReturnCode $? "Can´t install MINICONDA, error $?" $WORKDIR
fi
export PATH=${PATH}:${INSTALL_DIR}/bin

if [[ "$OSTYPE" == "darwin"* ]]; then
	# Try to update conda packages, because for macOS almost every dependency in the environment.yml is missing.
	echo "Updating conda"
	conda update -y conda
fi

# Install Python dependencies
echo "@PROGRESS@|50|Creating Python environment|"
echo "Creating Python environment"
conda env create -f $DIR/environment.yml
checkReturnCode $? "Can´t create MINICONDA environment, error $?" $WORKDIR

# Marks the environment as success installation
\cp -r $DIR/resources/version.txt $WORKDIR
echo "@PROGRESS@|60|Python environment ready|"
echo "Python environment ready!"
