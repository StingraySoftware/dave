
//Adds new Phaseogram Tab Panel
function addPHTabPanel(navBarList, panelContainer, plotConfig, projectConfig, id, navItemClass){
  return new PHTabPanel(!isNull(id) ? id : "Tab_" + tabPanels.length,
                        "TabPanelTemplate",
                        !isNull(navItemClass) ? navItemClass : "NavItem_" + tabPanels.length,
                        theService, navBarList, panelContainer, plotConfig, projectConfig);
}

//Subscribes the load workspace PHTabPanel function
tabPanelsLoadFns["PHTabPanel"] = function (tabConfig) {
  //Creates new Periodogram Tab Panel
  return addPHTabPanel($("#navbar").find("ul").first(),
                      $(".daveContainer"),
                      tabConfig.plotConfig,
                      null,
                      tabConfig.id,
                      tabConfig.navItemClass);
}

//Phaseogram Tab Panel
function PHTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer, plotConfig, projectConfig) {

  var currentObj = this;
  tabPanels.push(this); // Insert on tabPanels here for preparing access to getTabForSelector from plots

  WfTabPanel.call(this, id, classSelector, navItemClass, service, navBarList, panelContainer);

  //PHTabPanel METHODS:

  this.getConfig = function () {
    return { type: "PHTabPanel",
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

    //Adds Long-term variability Plot to outputPanel
    this.pgPlot = new PgPlot(
                      this.id + "_pg_" + (new Date()).getTime(),
                      $.extend(true, $.extend(true, {}, plotConfig), {
                        styles: { type: "ligthcurve",
                                  title: "Power Density Spectrum (PDS)",
                                  labels: ["Frequency (Hz)", "Power"],
                                  selectable: false,
                                  showFitBtn: true }
                      }),
                      this.service.request_power_density_spectrum,
                      function (filters) {
                        //onFiltersChangedFromPlot
                        currentObj.freqRangeSelector.setValues( filters[0].from, filters[0].to );
                      },
                      function (comesFromLombScargle) {
                        //On PgPlot Plot Ready
                        if (!isNull(currentObj.pgPlot.data)
                            && currentObj.pgPlot.data[0].values.length > 0){
                              currentObj.outputPanel.onPlotReady();
                              if (isNull(currentObj.freqRangeSelector)){
                                //We allready know the freq range, so create controls
                                currentObj.addControls();
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

    //Adds Pulse Search Plot to outputPanel
    this.psPlot = new PulseSearchPlot(
                      this.id + "_ph_" + (new Date()).getTime(),
                      $.extend(true, $.extend(true, {}, plotConfig), {
                        styles: { title: "Pulse Search Results",
                                  labels: ["Frequency (Hz)", "Statistics - d.o.f."],
                                  selectable: false }
                      }),
                      this.service.request_pulse_search,
                      this.outputPanel.onFiltersChangedFromPlot,
                      function () {
                        //On ZSearchPlot Plot Ready
                        waitingDialog.hide();
                        currentObj.outputPanel.onPlotReady();
                        currentObj.onCandidateFrequenciesFound();
                      },
                      null,
                      "fullWidth",
                      false
                    );
    this.psPlot.hide();
    this.addPlot(this.psPlot, false);

    //Adds Profile Plot to outputPanel
    this.prPlot = new ProfilePlot(
                      this.id + "_pr_" + (new Date()).getTime(),
                      $.extend(true, $.extend(true, {}, plotConfig), {
                        styles: { title: "Profile",
                                  labels: ["Phase", "Counts"],
                                  selectable: false }
                      }),
                      null,
                      this.outputPanel.onFiltersChangedFromPlot,
                      currentObj.outputPanel.onPlotReady,
                      null,
                      "fullWidth",
                      false
                    );
    this.prPlot.hide();
    this.addPlot(this.prPlot, false);

    //Adds Phaseogram Plot to outputPanel
    this.phPlot = new PhPlot(
                      this.id + "_ph_" + (new Date()).getTime(),
                      $.extend(true, $.extend(true, {}, plotConfig), {
                        styles: { title: "Phaseogram",
                                  labels: ["Color", "Phase", "TIME (" + this.projectConfig.timeUnit  + ")"],
                                  selectable: false }
                      }),
                      null,
                      this.outputPanel.onFiltersChangedFromPlot,
                      currentObj.outputPanel.onPlotReady,
                      null,
                      "fullScreen",
                      false,
                      this.projectConfig
                    );
    this.phPlot.hide();
    this.addPlot(this.phPlot, false);

    //Request plot data after all plots were added
    this.pgPlot.onDatasetValuesChanged(this.outputPanel.getFilters());
  }

  this.addControls = function(){

    this.pulseSearchSection = getSection ("Pulse Search", "pulseSearch", true, null, "HlSection");
    var $pulseSearchContainer = getSectionContainer(this.pulseSearchSection);

    //Adds frequency range selector
    var freqRange = this.pgPlot.getDefaultFreqRange();
    this.freqRangeSelector = new sliderSelector(this.id + "_FreqRange",
                                      "Frequency range (Hz):",
                                      { table:"EVENTS", column:"FREQ", source: "frequency" },
                                      freqRange[0], freqRange[1],
                                      this.onFreqRangeValuesChanged,
                                      null,
                                      function( event, ui ) {
                                        currentObj.freqRangeSelector.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
                                      },
                                      null,
                                      getStepSizeFromRange(freqRange[1] - freqRange[0], 100));
    this.freqRangeSelector.setEnabled(true);
    $pulseSearchContainer.append(this.freqRangeSelector.$html);

    //Adds Pulse Search Advanced controls container
    var $pulseSearchAdv = getSection ("Pulse Search (advanced)", "pulseSearchAdv", currentObj.pulseSearchAdvEnabled, function ( enabled ) {
       currentObj.pulseSearchAdvEnabled = enabled;
    });
    var $pulseSearchAdvContainer = getSectionContainer($pulseSearchAdv);

    //Creates Pulse search mode radios on Pulse Search Advanced container
    var $psModeRadiosCont = getRadioControl(this.id,
                                            "Search Mode",
                                            "psMode",
                                            [
                                              { id:"ZNS", label:"Z-squared", value:"z_n_search"},
                                              { id:"EF", label:"Epoch folding", value:"epoch_folding"}
                                            ],
                                            this.psPlot.plotConfig.mode,
                                            function(value) {
                                              currentObj.psPlot.plotConfig.mode = value;
                                              setVisibility(currentObj.toolPanel.$html.find(".harmonics"), value=="z_n_search");
                                            });
    $pulseSearchAdvContainer.append($psModeRadiosCont);

    //Creates extra fields on Pulse Search Advanced container
    $pulseSearchAdvContainer.append($('<p>Pulse peak oversampling:</br><input id="os_' + this.id + '" class="inputOS" type="text" name="os_' + this.id + '" placeholder="' + this.psPlot.ps_opts.oversampling.default + '" value="' + this.psPlot.ps_opts.oversampling.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.psPlot.ps_opts.oversampling.min + '-' + this.psPlot.ps_opts.oversampling.max + '</span></p>' +
                                       '<p class="harmonics">Number of harmonics:</br><input id="nh_' + this.id + '" class="inputNH" type="text" name="nh_' + this.id + '" placeholder="' + this.psPlot.ps_opts.nharm.default + '" value="' + this.psPlot.ps_opts.nharm.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.psPlot.ps_opts.nharm.min + '-' + this.psPlot.ps_opts.nharm.max + '</span></p>' +
                                       '<p>Number of bins:</br><input id="nb_' + this.id + '" class="inputNB" type="text" name="nb_' + this.id + '" placeholder="' + this.psPlot.ps_opts.nbin.default + '" value="' + this.psPlot.ps_opts.nbin.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.psPlot.ps_opts.nbin.min + '-' + this.psPlot.ps_opts.nbin.max + '</span></p>' +
                                       '<p>Length of the segments:</br><input id="ls_' + this.id + '" class="inputLS" type="text" name="ls_' + this.id + '" placeholder="' + this.psPlot.ps_opts.segment_size.default + '" value="' + this.psPlot.ps_opts.segment_size.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.psPlot.ps_opts.segment_size.min + '-' + this.psPlot.ps_opts.segment_size.max + '</span></p>'));
    $pulseSearchContainer.append($pulseSearchAdv);

    //Adds Run Pulse Search button
    var searchBtn = $('<button class="btn btn-primary searchBtn"><i class="fa ffa-signal" aria-hidden="true"></i> Run Pulse Search</button>');
    searchBtn.click(function () {
      currentObj.onPulseSearchClick();
    });
    $pulseSearchContainer.append(searchBtn);
    this.toolPanel.$html.find(".fileSelectorsContainer").append(this.pulseSearchSection);


    //Adds phaseogram controls
    var $phaseogram = getSection ("Phaseogram", "phaseogram", true, null, "HlSection");
    $phaseogram.hide();
    var $phaseogramContainer = getSectionContainer($phaseogram);

    //Candidate frequency selector
    var selectId = 'candFreqChooser_' + this.id;
    $phaseogramContainer.append($('<label for="' + selectId + '">Found pulses:</label>'));
    this.candFreqChooser = $('<select name="' + selectId + '" id="' + selectId + '"></select>');
    $phaseogramContainer.append(this.candFreqChooser);

    //Candidate frequency slider
    this.freqSelector = new BinSelector(this.id + "_freqSelector",
                                      "Frequency tunning:",
                                      freqRange[0], freqRange[1], this.freqRangeSelector.step, (freqRange[1] - freqRange[0])/2,
                                      this.onFreqSelectorValuesChanged,
                                      function( event, ui ) {
                                        currentObj.freqSelector.setValues( ui.values[ 0 ], "slider");
                                        currentObj.onFreqSelectorValuesChanged();
                                      });
    this.freqSelector.precision = 5;
    this.freqSelector.inputChanged = function ( event ) {
       currentObj.freqSelector.setValues( getInputFloatValue(currentObj.freqSelector.fromInput, currentObj.psPlot.candidateFreq) );
       currentObj.onFreqSelectorValuesChanged();
    };
    $phaseogramContainer.append(this.freqSelector.$html);

    var restoreBtn = $('<button class="btn btn-default restoreBtn" style="float: right; margin-top: -30px;">Restore</button>');
    restoreBtn.click(function () {
      if (!isNull(currentObj.candidateFrequency)){
        currentObj.freqSelector.setValues(currentObj.candidateFrequency);
        currentObj.phPlot.plotConfig.f = currentObj.candidateFrequency;
        currentObj.getPhaseogramFromServer();
      }
    });
    this.freqSelector.$html.find(".selectorContainer").prepend(restoreBtn);

    //Adds phaseogram advanced controls
    var $phaseogramAdv = getSection ("Phaseogram (advanced)", "phaseogramAdv", currentObj.phaseogramAdvEnabled, function ( enabled ) {
       currentObj.phaseogramAdvEnabled = enabled;
    });
    var $phaseogramAdvContainer = getSectionContainer($phaseogramAdv);
    $phaseogramAdvContainer.append($('<p>Number of phase bins:</br><input id="nph_' + this.id + '" class="inputNPH" type="text" name="nph_' + this.id + '" placeholder="' + this.phPlot.ph_opts.nph.default + '" value="' + this.phPlot.ph_opts.nph.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.phPlot.ph_opts.nph.min + '-' + this.phPlot.ph_opts.nph.max + '</span></p>' +
                                      '<p>Number of time bins:</br><input id="ntb_' + this.id + '" class="inputNTB" type="text" name="ntb_' + this.id + '" placeholder="' + this.phPlot.ph_opts.nt.default + '" value="' + this.phPlot.ph_opts.nt.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.phPlot.ph_opts.nt.min + '-' + this.phPlot.ph_opts.nt.max + '</span></p>'));
    $phaseogramAdvContainer.find("input").on('change', this.onPHTexboxesChanged);
    $phaseogramContainer.append($phaseogramAdv);

    this.toolPanel.$html.find(".fileSelectorsContainer").append($phaseogram);
  }

  this.onPulseSearchClick = function() {
    waitingDialog.show('Running pulse search...');
    currentObj.psPlot.plotConfig.freq_range = [currentObj.freqRangeSelector.fromValue, currentObj.freqRangeSelector.toValue];
    currentObj.psPlot.plotConfig.oversampling = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputOS"), currentObj.psPlot.ps_opts.oversampling.default, currentObj.psPlot.ps_opts.oversampling.min, currentObj.psPlot.ps_opts.oversampling.max);
    currentObj.psPlot.plotConfig.nharm = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputNH"), currentObj.psPlot.ps_opts.nharm.default, currentObj.psPlot.ps_opts.nharm.min, currentObj.psPlot.ps_opts.nharm.max);
    currentObj.psPlot.plotConfig.nbin = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputNB"), currentObj.psPlot.ps_opts.nbin.default, currentObj.psPlot.ps_opts.nbin.min, currentObj.psPlot.ps_opts.nbin.max);
    currentObj.psPlot.plotConfig.segment_size = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputLS"), currentObj.psPlot.ps_opts.segment_size.default, currentObj.psPlot.ps_opts.segment_size.min, currentObj.psPlot.ps_opts.segment_size.max);
    currentObj.psPlot.show();
  }

  this.onFreqSelectorValuesChanged = function(){
    currentObj.phPlot.plotConfig.f = currentObj.freqSelector.value;
    if (!isNull(currentObj.freqSelectorTimeOutId)){
      clearTimeout(currentObj.freqSelectorTimeOutId);
    }
    currentObj.freqSelectorTimeOutId = setTimeout( function () {
      currentObj.getPhaseogramFromServer();
    }, 350);
  }

  this.onPHTexboxesChanged = function(){
    currentObj.phPlot.plotConfig.nph = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputNPH"), currentObj.phPlot.plotConfig.nph, currentObj.phPlot.ph_opts.nph.min, currentObj.phPlot.ph_opts.nph.max);
    currentObj.phPlot.plotConfig.nt = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputNTB"), currentObj.phPlot.plotConfig.nt, currentObj.phPlot.ph_opts.nt.min, currentObj.phPlot.ph_opts.nt.max);
    currentObj.getPhaseogramFromServer();
  }

  this.onCandidateFrequenciesFound = function () {
    if (currentObj.psPlot.candidateFreqs.length > 0) {

      //If we have candidate frequency we can continue plotting the plofile and phaseogram
      //Fill candidate frequencies selector
      currentObj.candFreqChooser.html("");
      for (i = 0; i < currentObj.psPlot.candidateFreqs.length; i++) {
        var candFreq = currentObj.psPlot.candidateFreqs[i];
        var option = '<option value="' + i + '" ' + ((i == 0) ? 'selected="selected"' : '') + '>' +
                        i + ' - '  + candFreq.freq + ' Hz , ' + fixedPrecision(candFreq.ratio * 100, 1)  + '%' +
                      '</option>';
        currentObj.candFreqChooser.append(option);
      }
      currentObj.candFreqChooser.selectmenu({
        change: function( event, ui ) {
          currentObj.onCandFreqChooserChanged();
        }
      });

      //Shows phaseogram controls
      var freqRange = currentObj.psPlot.plotConfig.freq_range;
      currentObj.freqSelector.setMinMaxValues(freqRange[0],
                                              freqRange[1],
                                              getStepSizeFromRange(freqRange[1] - freqRange[0], 1000));
      setSectionState (currentObj.pulseSearchSection, false);
      setVisibility(currentObj.toolPanel.$html.find(".phaseogram"), true);

      //Minimize Pulse Search Plots
      if (currentObj.pgPlot.$html.hasClass("fullWidth")) {
        currentObj.pgPlot.btnFullScreen.click();
      }
      if (currentObj.psPlot.$html.hasClass("fullWidth")) {
        currentObj.psPlot.btnFullScreen.click();
      }

      //Show Phaseogram
      currentObj.prPlot.show();
      currentObj.phPlot.show();

      //Force refresh controls
      currentObj.onCandFreqChooserChanged();

    } else {
      currentObj.prPlot.hide();
      currentObj.phPlot.hide();
      setVisibility(currentObj.toolPanel.$html.find(".phaseogram"), false);
    }
  }

  this.onCandFreqChooserChanged = function () {
    var candFreqIdx = parseInt(currentObj.candFreqChooser.val());
    var candFreq = currentObj.psPlot.candidateFreqs[candFreqIdx];
    currentObj.candidateFrequency = candFreq.freq;
    currentObj.freqSelector.setValues(currentObj.candidateFrequency);
    currentObj.onFreqSelectorValuesChanged();
  }

  this.getPhaseogramFromServer = function () {

    log("PhTabPanel getPhaseogramFromServer...");

    if (!isNull(currentObj.currentRequest) && !isNull(currentObj.currentRequest.abort)) {
      currentObj.currentRequest.abort();
    }

    currentObj.outputPanel.setPlotsReadyState(false);

    currentObj.currentRequest = currentObj.service.request_phaseogram(currentObj.phPlot.plotConfig, function( jsdata ) {

      if (!isNull(jsdata.abort)){
        log("Current request aborted, PhTabPanel: " + currentObj.id);
        if (data.statusText == "error"){
          //If abort cause is because python server died
          currentObj.outputPanel.setPlotsReadyState(true);
        }
        return; //Comes from request abort call.
      }

      log("PHData received!, PhTabPanel: " + currentObj.id);
      data = JSON.parse(jsdata);

      if (isNull(data) || data.length != 6) {
        log("onPlotReceived wrong data!, PhTabPanel: " + currentObj.id);
        currentObj.outputPanel.setPlotsReadyState(true);
        return;

      } else {

        //Sends data to phPlot
        if (currentObj.phPlot.isVisible) {
          currentObj.phPlot.setData([ data[0], data[1], data[2] ]);
        }

        //Sends data to prPlot
        if (currentObj.prPlot.isVisible) {
          currentObj.prPlot.setData([ data[3], data[4], data[5] ]);
        }

        currentObj.outputPanel.setPlotsReadyState(true);
      }
    });

  };

  //Set the selected plot configs
  this.plotConfig = plotConfig;

  this.pulseSearchAdvEnabled = false;
  this.phaseogramAdvEnabled = false;

  this.setTitle("Phaseogram");
  this.wfSelector.find(".loadBtn").html('<i class="fa fa-fw fa-line-chart"></i>Analyze');

  //Preapares PG toolpanel data
  this.toolPanel.clearFileSelectors();
  var label = isNull(plotConfig.styles.title) ? "File:" : plotConfig.styles.title;
  this.toolPanel.addSelectedFile(label, getFilename(plotConfig.filename));

  this.outputPanel.getFilters = function () {
    return currentObj.phPlot.plotConfig.filters;
  }

  if (!isNull(projectConfig)){
    this.projectConfig.updateFromProjectConfigs([projectConfig]);
    this.createPlots();
  }

  log("PHTabPanel ready! id: " + this.id);
  return this;
}
