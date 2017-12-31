function RmsPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;
  plotConfig.n_bands = 25;
  plotConfig.freq_range = [-1, -1];
  plotConfig.energy_range = [-1, -1];
  plotConfig.white_noise = -999;
  plotConfig.default_energy_range = [-1, -1];

  this.freq_range_title = (plotConfig.x_axis_type != "countrate") ? "RMS Frequency Range (Hz):" : "Frequency Range (Hz):";
  this.energy_range_title = "Energy range (keV)";

  if (projectConfig.schema.isEventsFile()) {
      var column = projectConfig.schema.getTable()["E"];
      if (!isNull(column)){

        //Adds Reference Band filter
        plotConfig.energy_range = [column.min_value, column.max_value];
        plotConfig.default_energy_range = [column.min_value, column.max_value];
        plotConfig.n_bands = (plotConfig.x_axis_type != "countrate") ? Math.min(Math.floor(column.max_value - column.min_value), 25) : 25;

      } else {
        log("RmsPlot error, plot" + currentObj.id + ", NO ENERGY COLUMN ON SCHEMA");
      }
  } else {
    log("RmsPlot error, plot" + currentObj.id + ", NO EVENTS TABLE ON SCHEMA");
  }

  PDSPlot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig);

  this.plotConfig.xAxisType = "linear";
  this.plotConfig.yAxisType = "linear";
  this.plotConfig.plotType = "X";
  this.plotConfig.norm = "frac";
  this.plotConfig.type = "Sng";

  if (plotConfig.x_axis_type == "countrate"){
    this.plotConfig.nsegm = 0;
    this.plotConfig.segment_size = 0;
  }

  this.onSettingsCreated = function(){

    //Hides pds settings controls that doesn't apply to rms plot
    this.xAxisRadios.hide();
    this.yAxisRadios.hide();
    this.plotTypeRadios.hide();
    this.normRadios.hide();

    //Adds frequency range selector
    this.addFrequencyRangeSelector(this.freq_range_title,
                                    { table:"EVENTS", column:"FREQ", source: "frequency" },
                                    ".rightCol");

    //Adds energy range selector
    this.addEnergyRangeControlToSetting(this.energy_range_title, ".rightCol");

    //Adds number of point control of rms plot
    if (plotConfig.x_axis_type != "countrate"){
      this.addNumberOfBandsControlToSettings("Nº Energy Segments", ".rightCol");
    } else {
      this.typeRadios.hide();
      this.segmSelector.$html.hide();
      this.rebinSelector.$html.hide();
      this.addNumberOfBandsControlToSettings("Nº Time Segments", ".leftCol");
    }

    this.addWhiteNoiseControlToSettings("White noise level", ".leftCol");
  }

  this.getLabel = function (axis) {
    return this.plotConfig.styles.labels[axis];
  }

  this.getAutoWhiteNoiseOffset = function () {
    return (!isNull(this.data) && this.data.length > 5) ? this.data[5].values : -999;
  }

  this.showFitWhiteNoiseDialog = function (plotType) {
    //Show White Noise Dialog
    var $fitWNODialog = $('<div id="fitWNODialogDialog_' + currentObj.id +  '" title="Calculate the White Noise Level:">' +
                                '<div class="fitWNODialogDialogContainer">' +
                                  '<p class="text-warning">For calculating the White Noise Level please do a fit of the Power Density Spectrum with Const model and a Lorentz model.</br>The resulting amplitude of the Const model after fitting and appliying the results will be the requested white noise level value.</p>' +
                                '</div>' +
                            '</div>');

    currentObj.$html.append($fitWNODialog);
    $fitWNODialog.dialog({
       width: 450,
       modal: true,
       buttons: {
         'Continue with fitting': function() {
            onFitPlotClicked(currentObj);
            $(this).dialog('close');
            $fitWNODialog.remove();
         },
         'Cancel': function() {
            $(this).dialog('close');
            $fitWNODialog.remove();
         }
       }
     });
     $fitWNODialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
  }

  log ("new RmsPlot id: " + this.id);

  return this;
}
