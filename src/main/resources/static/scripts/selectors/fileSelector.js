fileSelectorCounter = 0;

function fileSelector(id, label, selectorKey, uploadFn, onFileChangedFn) {

  var currentObj = this;

  this.id = id;
  this.label = label;
  this.selectorKey = selectorKey;
  this.uploadFn = uploadFn;
  this.onFileChangedFn = onFileChangedFn;
  this.uploadInputId = 'upload_input' + fileSelectorCounter;
  fileSelectorCounter ++;

  this.$html = $('<div class="fileSelector ' + id + '">' +
                    '<h3>' + label + '</h3>' +
                    '<label class="fileName">' +
                    '</label>' +
                    '<button class="btn btn-primary btnChoose"><i class="fa fa-folder-open" aria-hidden="true"></i> Choose files</button>' +
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
         var newFilename = fullfilename.replace(/^.*[\\\/]/, '');
         waitingDialog.show('Uploading file: ' + newFilename);

       } else if (this.files.length > 1) {

         waitingDialog.show('Uploading files...');
       }

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
     if (!isNull(filenames)) {
      if (filenames.length == 1) {
        text = filenames[0];
      }
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

   this.onUploadSuccess();

   log ("new fileSelector id: " + id + ", label: " + label + ", inputId: " + this.uploadInputId);

   return this;
}
