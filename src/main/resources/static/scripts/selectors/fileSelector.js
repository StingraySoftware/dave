fileSelectorCounter = 0;

function fileSelector(id, label, selectorKey, uploadFn, onFileChangedFn) {

  var currentObj = this;

  this.id = id;
  this.label = label;
  this.selectorKey = selectorKey;
  this.uploadFn = uploadFn;
  this.onFileChangedFn = onFileChangedFn;
  this.uploadInputId = 'upload_input' + fileSelectorCounter;
  this.btnText = '<i class="fa fa-folder-open" aria-hidden="true"></i> Choose file';
  this.multiFileEnabled = false;
  fileSelectorCounter ++;

  this.$html = $('<div class="fileSelector ' + id + '">' +
                    '<h3>' + label + '</h3>' +
                    '<label class="fileName">' +
                    '</label>' +
                    '<button class="btn btn-primary btnChoose">' + this.btnText + '</button>' +
                    '<button class="btn btn-warning btnChange">Change</button>' +
                    '<form action="" method="POST" enctype="multipart/form-data">' +
                      '<input id="' + this.uploadInputId + '" name="file" type="file" style="width:100%" multiple/>' +
                    '</form>' +
                  '</div>');

  this.$input = this.$html.find("#" + this.uploadInputId);
  this.$input.hide();

  this.btnChoose = this.$html.find(".btnChoose");
  this.btnChange = this.$html.find(".btnChange");

  this.$input.on('change', function () {
      if (this.files.length > 0) {
       if (this.files.length == 1) {

         //Normal file upload!
         var fullfilename= this.value;
         var newFilename = getFilename(fullfilename);
         waitingDialog.show('Uploading file: ' + newFilename);

       } else if (this.files.length > 1) {

         if (!currentObj.multiFileEnabled) {
            showError("Multi file not supported");
            return;
         }

         waitingDialog.show('Uploading files...');
       }

       if (isNull(this.files[0].path) || !CONFIG.IS_LOCAL_SERVER) {

         // If path is null is beacause we are running on a NON electron browser,
         // or if server is on remote configuration, then we have to use the upload
         // to server method for storing the file on server uploadsdataset folder.

         var formData = new FormData(currentObj.$html.find('form')[0]);
         currentObj.uploadFn(function (response) {
                                         var jsonRes = JSON.parse(response);
                                         if (jsonRes.error != undefined) {
                                           currentObj.onUploadError(jsonRes.error);
                                         } else {
                                           currentObj.onUploadSuccess(jsonRes);
                                           currentObj.onFileChangedFn(jsonRes, currentObj.selectorKey);
                                         };
                                     },
                             currentObj.onUploadProgress,
                             currentObj.onUploadError,
                             formData);
       } else {

         //Server is local, and path is defined by electron runtime environment

         filenames = jQuery.map( this.files, function( file, i ) {
          return file.path;
          });
         currentObj.onUploadSuccess(filenames);
         currentObj.onFileChangedFn(filenames, currentObj.selectorKey);

       }

     } else {
       currentObj.onUploadSuccess();
     }
   });

   this.$html.find(".btn").click(function () {
     currentObj.showSelectFile();
   });

   this.showSelectFile = function () {
     this.$input.focus().click();
   };

   this.onUploadSuccess = function ( filenames ) {
     waitingDialog.hideProgress();
     var text = "";
     if (!isNull(filenames) && (filenames.length > 0)) {
      $.each(filenames, function(i, filepath) {
        text += ((text != "") ? ",</br>" : "") + getFilename(filepath);
      });
     }
     this.$html.find(".fileName").html(text);

     if (text == "") {
       this.btnChange.hide();
       this.btnChoose.show();
     } else {
       this.btnChoose.hide();
       this.btnChange.show();
     }
   }

   this.onUploadProgress = function ( e ) {
     if (e.lengthComputable) {
        waitingDialog.setProgress(Math.ceil((e.loaded/e.total) * 100));
      }
   }

   this.onUploadError = function ( error ) {
     waitingDialog.hideProgress();
     if (!isNull(error)) {
       waitingDialog.hide();
       showError();
       log("onUploadError:" + JSON.stringify(error));
       currentObj.$input.val("");
     }
   }

   this.show = function () {
     this.$html.show();
   }

   this.hide = function () {
     this.$html.hide();
   }

   this.disable = function (msg) {
     this.$html.find("label").html('<a href="#" class="btn btn-danger btnWarn"><div>' +
                                     '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' + msg +
                                   '</div></a>');
   }

   this.showInfoText = function (text) {
     this.$html.find("label").append('<p class="InfoText">' + text + '</a>');
   }

   this.setMultiFileEnabled = function (enabled) {
     this.multiFileEnabled = enabled;
     if (this.multiFileEnabled) {
       this.$html.find("h3").text(this.label.replace("File", "Files"));
       this.btnChoose.html(this.btnText.replace("file", "files"));
       this.$input.attr("multiple", "");
     } else {
       this.$html.find("h3").text(this.label);
       this.btnChoose.html(this.btnText);
       this.$input.removeAttr("multiple");
     }
   }

   this.onUploadSuccess();

   log ("new fileSelector id: " + id + ", label: " + label + ", inputId: " + this.uploadInputId);

   return this;
}

function getFilename (filePath) {
  return filePath.replace(/^.*[\\\/]/, '');
}
