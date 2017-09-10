
//Adds new Periodogram Tab Panel
function addPGTabPanel(navBarList, panelContainer, plotConfig, projectConfig, id, navItemClass){
  return new PGTabPanel(!isNull(id) ? id : "Tab_" + tabPanels.length,
                        "TabPanelTemplate",
                        !isNull(navItemClass) ? navItemClass : "NavItem_" + tabPanels.length,
                        theService, navBarList, panelContainer, plotConfig, projectConfig);
}

//Subscribes the load workspace PGTabPanel function
tabPanelsLoadFns["PGTabPanel"] = function (tabConfig) {
  //Creates new Periodogram Tab Panel
  return addPGTabPanel($("#navbar").find("ul").first(),
                      $(".daveContainer"),
                      tabConfig.plotConfig,
                      null,
                      tabConfig.id,
                      tabConfig.navItemClass);
}

//Periodogram Tab Panel
function PGTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer, plotConfig, projectConfig) {

  var currentObj = this;
  tabPanels.push(this); // Insert on tabPanels here for preparing access to getTabForSelector from plots

  WfTabPanel.call(this, id, classSelector, navItemClass, service, navBarList, panelContainer);

  //PGTabPanel METHODS:

  this.getConfig = function () {
    return { type: "PGTabPanel",
             id: this.id,
             navItemClass: this.navItemClass,
             plotConfig: this.plotConfig,
             projectConfig: this.projectConfig.getConfig(),
             outputPanelConfig: this.outputPanel.getConfig()
           };
  }

  this.setConfig = function (tabConfig, callback) {
    log("setConfig for tab " + this.id);

    this.projectConfig = $.extend( this.projectConfig, tabConfig.projectConfig );
    this.createPlots();
    this.outputPanel.setConfig(tabConfig.outputPanelConfig);

    callback();
  }

  this.createPlots = function () {
    //Adds Long-term variability of AGN Plot to outputPanel
    this.pgPlot = new PgPlot(
                      this.id + "_pg_" + (new Date()).getTime(),
                      $.extend(true, $.extend(true, {}, plotConfig), {
                        styles: { type: "ligthcurve",
                                  title: "Lomb-Scargle Periodogram & PDS",
                                  labels: ["Frequency (Hz)", "Power"],
                                  selectable: false,
                                  showFitBtn: true }
                      }),
                      this.service.request_power_density_spectrum,
                      function (filters) {
                        //onFiltersChangedFromPlot
                        currentObj.freqRangeSelector.setValues( filters[0].from, filters[0].to );
                        currentObj.onFreqRangeValuesChanged();
                      },
                      function (comesFromLombScargle) {
                        if (!isNull(currentObj.pgPlot.data)
                            && currentObj.pgPlot.data[0].values.length > 0){
                              currentObj.outputPanel.onPlotReady();
                              if (isNull(currentObj.freqRangeSelector)){
                                currentObj.addPgControls();
                              } else if (isNull(comesFromLombScargle) || !comesFromLombScargle) {
                                currentObj.getLombScargleFromServer();
                              }
                        } else {
                          currentObj.pgPlot.showWarn("Wrong PDS data");
                        }
                      },
                      null,
                      "fullWidth",
                      false,
                      this.projectConfig
                    );
    this.addPlot(this.pgPlot, false);

    //Request plot data after all plots were added
    this.pgPlot.onDatasetValuesChanged(this.outputPanel.getFilters());
  }

  this.addPgControls = function(){

    //Adds frequency range selector
    var freqRange = this.pgPlot.getDefaultFreqRange();
    this.freqRangeSelector = new sliderSelector(this.id + "_FreqRange",
                                      "Frequency range (Hz):",
                                      { table:"EVENTS", column:"FREQ", source: "frequency" },
                                      "From", "To",
                                      freqRange[0], freqRange[1],
                                      this.onFreqRangeValuesChanged,
                                      null,
                                      function( event, ui ) {
                                        currentObj.freqRangeSelector.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
                                        currentObj.onFreqRangeValuesChanged();
                                      });
    this.freqRangeSelector.step = getStepSizeFromRange(freqRange[1] - freqRange[0], 100);
    this.freqRangeSelector.setEnabled(true);
    this.onFreqRangeValuesChanged();
    this.toolPanel.$html.find(".fileSelectorsContainer").append(this.freqRangeSelector.$html);

    //Adds samples_per_peak and nyquist_factor contorls
    var $textboxes = $('<h3>Samples per peak:</h3><p><input id="spp_' + this.id + '" class="inputSPP" type="text" name="spp_' + this.id + '" placeholder="' + this.pgPlot.ls_opts.samples_per_peak.default + '" value="' + this.pgPlot.ls_opts.samples_per_peak.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.pgPlot.ls_opts.samples_per_peak.min + '-' + this.pgPlot.ls_opts.samples_per_peak.max + '</span></p>' +
                       '<h3>Nyquist factor:</h3><p><input id="nf_' + this.id + '" class="inputNF" type="text" name="nf_' + this.id + '" placeholder="' + this.pgPlot.ls_opts.nyquist_factor.default + '" value="' + this.pgPlot.ls_opts.nyquist_factor.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.pgPlot.ls_opts.nyquist_factor.min + '-' + this.pgPlot.ls_opts.nyquist_factor.max + '</span></p>');
    $textboxes.find("input").on('change', this.onTexboxesChanged);
    this.toolPanel.$html.find(".fileSelectorsContainer").append($textboxes);

    //Creates Normalization radios
    var $lsNormRadiosCont = getRadioControl (this.id,
                                            "Normalization",
                                            "ls_normalization",
                                            [
                                              { id:"Std", label:"Standard", value:"standard"},
                                              { id:"Mdl", label:"Model", value:"model"},
                                              { id:"Log", label:"Logarithmic", value:"log"},
                                              { id:"Psd", label:"PSD", value:"psd"}
                                            ],
                                            this.pgPlot.plotConfig.ls_norm,
                                            function(value) {
                                              currentObj.pgPlot.plotConfig.ls_norm = value;
                                              currentObj.getLombScargleFromServer();
                                            });
    this.toolPanel.$html.find(".fileSelectorsContainer").append($lsNormRadiosCont);

  }

  this.onFreqRangeValuesChanged = function() {
    currentObj.pgPlot.plotConfig.freq_range = [currentObj.freqRangeSelector.fromValue, currentObj.freqRangeSelector.toValue];
    currentObj.getLombScargleFromServer();
  }

  this.onTexboxesChanged = function(){
    currentObj.pgPlot.plotConfig.samples_per_peak = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputSPP"), currentObj.pgPlot.plotConfig.samples_per_peak, currentObj.pgPlot.ls_opts.samples_per_peak.min, currentObj.pgPlot.ls_opts.samples_per_peak.max);
    currentObj.pgPlot.plotConfig.nyquist_factor = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputNF"), currentObj.pgPlot.plotConfig.nyquist_factor, currentObj.pgPlot.ls_opts.nyquist_factor.min, currentObj.pgPlot.ls_opts.nyquist_factor.max);
    currentObj.getLombScargleFromServer();
  }

  this.getLombScargleFromServer = function () {

    log("PgTabPanel getLombScargleFromServer...");

    if (!isNull(currentObj.currentRequest) && !isNull(currentObj.currentRequest.abort)) {
      currentObj.currentRequest.abort();
    }

    currentObj.outputPanel.setPlotsReadyState(false);

    currentObj.currentRequest = currentObj.service.request_lomb_scargle(currentObj.pgPlot.plotConfig, function( jsdata ) {

      if (!isNull(jsdata.abort)){
        log("Current request aborted, PgTabPanel: " + currentObj.id);
        return; //Comes from request abort call.
      }

      log("PGData received!, PgTabPanel: " + currentObj.id);
      data = JSON.parse(jsdata);

      if (isNull(data)) {
        log("onPlotReceived wrong data!, PgTabPanel: " + currentObj.id);
        currentObj.outputPanel.setPlotsReadyState(true);
        return;

      } else {

        //Sends data to agnPlot
        if (currentObj.pgPlot.isVisible) {
          currentObj.pgPlot.setLombScargleData(data);
        }
      }
    });

  };

  //Set the selected plot configs
  this.plotConfig = plotConfig;

  this.setTitle("Periodogram");
  this.wfSelector.find(".loadBtn").html('<i class="fa fa-fw fa-line-chart"></i>Analyze');

  //Preapares PG toolpanel data
  this.toolPanel.clearFileSelectors();
  var label = isNull(plotConfig.styles.title) ? "File:" : plotConfig.styles.title;
  this.toolPanel.addSelectedFile(label, getFilename(plotConfig.filename));

  this.outputPanel.getFilters = function () {
    return currentObj.pgPlot.plotConfig.filters;
  }

  if (!isNull(projectConfig)){
    this.projectConfig.updateFromProjectConfigs([projectConfig]);
    this.createPlots();
  }

  log("PGTabPanel ready! id: " + this.id);
  return this;
}
