 function showBulkAnalisysDialog (tabPanel) {

  //Show Bulk Analisys dialog
  var $bulkDialog = $('<div id="bulkDialog_' + tabPanel.id +  '" title="Bulk Analisys">' +
                          '<div class="bulkDialogContainer">' +
                            '<p>Please select and upload a Bulk File.</br>Bulk files are text files with the absolute paths of each file to work with per line.</p>' +
                          '</div>' +
                      '</div>');

  var closeDialog = function () {
    $bulkDialog.remove();
  }

  //Function called when bulk file is selected
  var onBulkFileLoadedFn = function(e, file) {
    try {
      if (file.type == "text/plain") {
        var contents = e.target.result;
        if (contents.length > 0) {

          var lines = contents.split("\n");
          log("Bulk start load, N lines: " + lines.length);

          var filesToCopy = [];
          for (i in lines){
            var path = lines[i];
            if ((path.length > 0) && !path.startsWith("#")){
              filesToCopy.push(path);
            }
          }

          if (filesToCopy.length > 0) {
            log("Bulk files to copy: " + filesToCopy.length);
            tabPanel.service.request_copy_files(filesToCopy, function(res) {

              if (!isNull(res)){
                var copiedFiles = JSON.parse(res);
                log("Bulk copied files: " + copiedFiles.length);

                tabPanel.projectConfig.setFiles("BULK", copiedFiles, file.name);

                closeDialog();

              } else {

                closeDialog();
                showError("Error uploading bulk file contents");
              }

            });
          }

        } else {
          closeDialog();
          showError("Empty Bulk File");
        }
      } else {
        closeDialog();
        showError("Wrong Bulk File format, requiered text/plain");
      }
   } catch (e) {
     closeDialog();
     showError("Error loading Bulk File", e);
   }
  };

  tabPanel.$html.append($bulkDialog);
  $bulkDialog.dialog({
     width: 450,
     modal: true,
     buttons: {
       'Upload Bulk File': function() {
          showLoadFile(onBulkFileLoadedFn);
          closeDialog();
       },
       'Cancel': function() {
          closeDialog();
       }
     }
   });
   $bulkDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
}
