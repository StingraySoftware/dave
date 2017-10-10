
// Shows first step of bulk analisys dialog: Upload bulk file
 function showBulkAnalisysDialog (tabPanel) {

  //Show Bulk Analisys dialog
  var $bulkDialog = $('<div id="bulkDialog_' + tabPanel.id +  '" title="Bulk Analisys">' +
                          '<div class="bulkDialogContainer">' +
                            '<p>Please select and upload a Bulk File.</br>Bulk files are text files with the absolute paths of each file to work with per line.</p>' +
                          '</div>' +
                      '</div>');

  //Function called when bulk file is selected
  var onBulkFileLoadedFn = function(e, file) {
    try {
      if (file.type == "text/plain") {
        var contents = e.target.result;
        if (contents.length > 0) {

          var lines = contents.split("\n");
          log("Bulk start load, N lines: " + lines.length);

          var filesToRead = [];
          for (i in lines){
            var path = lines[i];
            if ((path.length > 0) && !path.startsWith("#")){
              filesToRead.push(path);
            }
          }

          if (filesToRead.length > 0) {
            log("Bulk files to copy: " + filesToRead.length);
            tabPanel.service.request_intermediate_files(filesToRead, function(res) {

              if (!isNull(res)){
                var intermediateFiles = JSON.parse(res);
                log("Bulk intermediate files: " + intermediateFiles.length);

                if (intermediateFiles.length > 0) {
                  tabPanel.projectConfig.setFiles("BULK", intermediateFiles, file.name);

                  $bulkDialog.remove();
                  showBulkAnalisysStep2Dialog(tabPanel);
                } else {

                  $bulkDialog.remove();
                  showError("Can't create any intermediate file");
                }

              } else {

                $bulkDialog.remove();
                showError("Error uploading bulk file contents");
              }

            });
          }

        } else {
          $bulkDialog.remove();
          showError("Empty Bulk File");
        }
      } else {
        $bulkDialog.remove();
        showError("Wrong Bulk File format, requiered text/plain");
      }
   } catch (e) {
     $bulkDialog.remove();
     showError("Error loading Bulk File", e);
   }
  };

  tabPanel.$html.append($bulkDialog);
  $bulkDialog.dialog({
     width: 450,
     modal: true,
     buttons: [
         {
          id: "uploadBulk",
          text: "Upload Bulk File",
          click:function() {
            showLoadFile(onBulkFileLoadedFn);
            $("#uploadBulk").text('Uploading...').prop("disabled",true);
            $("#cancelBulk").prop("disabled",true);
          }
        },
        {
         id: "cancelBulk",
         text: "Cancel",
         click:function() {
           $bulkDialog.remove();
         }
       }
     ]
   });
   $bulkDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
}

// Shows second step of bulk analisys dialog: Plot selections
function showBulkAnalisysStep2Dialog (tabPanel) {

 //Show Bulk Analisys Step 2 dialog
 var visiblePlots = tabPanel.outputPanel.plots.filter(function(plot) { return plot.isVisible && !plot.isBulkPlot(); });
 if (visiblePlots.length > 0) {

   var visiblePlotButtons = "";
   for (i in visiblePlots) {
      var plot = visiblePlots[i];
      visiblePlotButtons += '<button class="btn btn-default btnSelect ' + plot.id + '" plotId="' + plot.id + '">' +
                            '<i class="fa fa-thumb-tack" aria-hidden="true"></i> ' + plot.plotConfig.styles.title +
                          '</button>';
    };

  } else {
    showError("At least one plot must be visible");
    return;
  }

  var $bulkDialog = $('<div id="bulkDialog_' + tabPanel.id +  '" title="Bulk Analisys">' +
                         '<div class="bulkDialogContainer">' +
                           '<p>Uploaded files: ' + tabPanel.projectConfig.bulkFilenames.length + ' </p>' +
                           '<p>Select at least one plot to proceed with bulk analisys:</p>' +
                           visiblePlotButtons +
                         '</div>' +
                     '</div>');

 $bulkDialog.find(".btnSelect").click(function(event){
    $(this).toggleClass("plotSelected");
    $("#proceedBulk").prop("disabled", $bulkDialog.find(".plotSelected").length == 0);
 });

 //Function called when plots are selected and proceed clicked
 var onBulkPlotSelectedFn = function(e, file) {
   try {

     var plotConfigs = [];
     $bulkDialog.find(".plotSelected").each(function( index ) {
        var plotId = $( this ).attr("plotId");
        var plot = tabPanel.outputPanel.getPlotById(plotId);
        plotConfigs.push(plot.getConfig());
      });

      var outdir = "BULK_" + new Date().toLocaleString().replace(/\ /g, "_").replace(/\:/g, "-").replace(/\//g, "-");
      var bulkAnalisysData = { filenames: tabPanel.projectConfig.bulkFilenames,
                               plotConfigs: plotConfigs,
                               outdir: outdir
                             };

      tabPanel.service.request_bulk_analisys(bulkAnalisysData, function(res) {
        try {

          result = JSON.parse(res);
          if (!isNull(result)){

            log("Bulk analisys success!!");

            //Cleans previous plots and analysis tab
            tabPanel.outputPanel.removePlotsById(tabPanel.projectConfig.getPlotsIdsByKey("BULK"));
            tabPanel.projectConfig.cleanPlotsIdsKey("BULK");
            tabPanel.toolPanel.clearBulkAnalisysPlotResults();

            for (i in result.plot_configs) {
              var plotConfigResults = result.plot_configs[i];
              var dirpath = outdir + "/" + plotConfigResults.plotId;

              var plotConfigsFlt = plotConfigs.filter(function(plotConfigs) { return plotConfigs.id == plotConfigResults.plotId; });
              var plotConfig = (plotConfigsFlt.length == 1) ? plotConfigsFlt[0] : null;
              if (!isNull(plotConfig)) {

                var plotBtnsContainer = tabPanel.toolPanel.addBulkAnalisysPlotResults(plotConfigResults.plotId,
                                                                                      plotConfig.styles.title);

                if (plotConfig.class == "LcPlot") {

                  //Changes axis from source plot, beacause the plot will work with lcs
                  var plotAxis = $.extend(true, [], plotConfig.axis);
                  plotAxis[0].table = "RATE";
                  plotAxis[1].table = "RATE";

                  for (i in plotConfigResults.filenames) {

                    var filename = plotConfigResults.filenames[i];

                    newPlotConfig = cleanPlotConfig($.extend(true, {}, plotConfig));// Creates copy for avoid change source plotConfig
                    newPlotConfig.filters = [];
                    newPlotConfig = $.extend(true, newPlotConfig, {
                                            filename: dirpath + "/" + filename,
                                            bck_filename: "",
                                            gti_filename: "",
                                            styles: { title: filename + " " + newPlotConfig.styles.title,
                                                      bulkPlot: true },
                                            axis: plotAxis
                                          });

                    var lcPlot = new LcPlot(
                                      tabPanel.outputPanel.generatePlotId("ligthcurve_" + filename),
                                      newPlotConfig,
                                      tabPanel.outputPanel.service.request_lightcurve,
                                      null,
                                      tabPanel.outputPanel.onPlotReady,
                                      plotBtnsContainer,
                                      "LcPlot " + (plotConfig.fullWidth) ? "fullWidth" : "",
                                      false
                                    );

                    lcPlot.applyValidFilters = function (filters) {
                      //Avoid filters to be updated from dataset values changed
                      this.plotConfig.filters = [];
                    }
                    lcPlot.updatePlotConfig = function () {
                      //Avoid plot config changes on refreshData
                    };

                    tabPanel.outputPanel.appendPlot(lcPlot, false);
                    tabPanel.projectConfig.addPlotId(lcPlot.id, "BULK");

                    lcPlot.hide();
                  }
                }

              } else {
                log("Bulk analisys error: Unknown plot: " + plotConfigResults.plotId);
              }

            };

            $bulkDialog.remove();
            return;

          }

        } catch (e) {
          log ("request_bulk_analisys results error: " + e);
        }

        $bulkDialog.remove();
        showError("Error on bulk analisys process");

      });

  } catch (e) {
    $bulkDialog.remove();
    showError("Error doing Bulk File", e);
  }
 };

 tabPanel.$html.append($bulkDialog);
 $bulkDialog.dialog({
    width: 450,
    modal: true,
    buttons: [
        {
         id: "proceedBulk",
         text: "Proceed with analisys",
         click:function() {
           onBulkPlotSelectedFn();
           $("#proceedBulk").text('Work in progress...').prop("disabled",true);
           $("#cancelBulk").prop("disabled",true);
         }
       },
       {
        id: "cancelBulk",
        text: "Cancel",
        click:function() {
          $bulkDialog.remove();
        }
      }
    ]
  });
  $("#proceedBulk").prop("disabled",true);
  $bulkDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
}
