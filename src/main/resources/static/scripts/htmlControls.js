
function cloneHtmlElement(id, classSelector) {
  return $("." + classSelector).clone().removeClass(classSelector).addClass(id);
}

function getInputIntValue($input, defaultValue) {
  return getInputValue($input, "int", defaultValue);
}

function getInputIntValueCropped ($input, defaultValue, min, max) {
  var value = Math.min(Math.max(getInputIntValue($input, defaultValue), min), max);
  $input.val(value).removeClass("wrongValue");
  return value;
}

function getInputFloatValue($input, defaultValue) {
  return getInputValue($input, "float", defaultValue);
}

function getInputFloatValueCropped ($input, defaultValue, min, max) {
  var value = Math.min(Math.max(getInputFloatValue($input, defaultValue), min), max);
  $input.val(value).removeClass("wrongValue");
  return value;
}

function getInputValue($input, type, defaultValue) {
  try {

      var value = NaN;
      var textVal = $input.val().replace(",", ".");
      $input.val(textVal);

      if (type == "float") {
        value = parseFloat(textVal);
      } else if (type == "int") {
        value = parseInt(textVal);
      }

      if (jQuery.isNumeric(textVal) && !isNaN(value)) {
        $input.removeClass("wrongValue");
        return value;
      } else {
        $input.addClass("wrongValue");
        return defaultValue;
      }

  } catch (e) {
    $input.addClass("wrongValue");
    return defaultValue;
  }
}

function getCheckedState(value) {
  return value ? 'checked="checked"' : "";
}

function getBootstrapRow() {
  return $('<div class="row"></div>');
}

function getCheckBox(cssClass, checked, onCheckChangedFn) {
  var checkBoxWrp = $('<div class="switch-wrapper">' +
                        '<div class="switch-btn fa ' + cssClass + '" aria-hidden="true"></div>' +
                      '</div>');
  var checkBox = checkBoxWrp.find(".switch-btn");
  checkBox.click( function ( event ) {
    var checked = !$(this).hasClass("fa-minus-square");
    setCheckBoxState ($(this), checked);
    onCheckChangedFn(checked);
  });
  setCheckBoxState (checkBox, checked);
  return checkBoxWrp;
}

function setCheckBoxState (checkBox, checked) {
  checkBox.removeClass("fa-plus-square");
  checkBox.removeClass("fa-minus-square");
  if (checked) {
    checkBox.addClass("fa-minus-square");
  } else {
    checkBox.addClass("fa-plus-square");
  }
}

function getInputBox (name, cssClass, title, defaultValue) {
  return '<label for="' + name + '">' + title + ':</label>' +
          '<input name="' + name + '" class="' + cssClass + '" type="text" placeholder="' + defaultValue + '" value="' + defaultValue + '" />';
}

function getRangeBoxCfg (name, cssClass, title, config, onChangeFn) {
  return getRangeBox (name, cssClass, title, config.default, config.min, config.max, onChangeFn);
}

function getRangeBox (name, cssClass, title, defaultValue, minValue, maxValue, onChangeFn) {
  var $rangeBox = $('<p>' + title + ':</br><input name="' + name + '" class="' + cssClass + '" type="text" placeholder="' + defaultValue + '" value="' + defaultValue + '" /> <span class="rangeBoxSpan">' + minValue + '-' + maxValue + '</span></p>');
  $rangeBox.find("input").on('change', function() {
    var value = getInputIntValueCropped($(this), defaultValue, minValue, maxValue);
    onChangeFn(value, $(this));
  });
  return $rangeBox;
}

function getSection (title, cssClass, checked, onCheckChangedFn, extraCssClasses){
  var $section = $('<div class="Section ' + cssClass + (isNull(extraCssClasses) ? '' : ' ' + extraCssClasses) +'">' +
                      '<h3>' + title + ':</h3>' +
                      '<div class="sectionContainer">' +
                      '</div>' +
                    '</div>');
  var $container = getSectionContainer ($section);
  setVisibility($container, checked);
  var sectionSwitchBox = getCheckBox(cssClass + "_switch", checked, function ( enabled ) {
     setVisibility($container, enabled);
     if (!isNull(onCheckChangedFn)) { onCheckChangedFn(enabled); }
  });
  $section.find("h3").append(sectionSwitchBox);
  return $section;
}

function setSectionState ($section, enabled){
  setVisibility(getSectionContainer ($section), enabled);
  setCheckBoxState ($section.find(".switch-btn").first(), enabled);
}

function getSectionContainer ($section){
  return $section.find(".sectionContainer").first();
}

function getRadioControl (containerId, title, cssClass, options, selectedValue, onChangeFn){
  var radioName = containerId + "_" + cssClass;
  var $radiosCont = $('<div class="' + cssClass + '">' +
                        '<h3>' + title + ':</h3>' +
                        '<fieldset></fieldset>' +
                      '</div>');

  for (var i = 0; i < options.length; i++){
    var option = options[i]; //{ id:"rad0", label:"Radio 0", value:"radio0"}
    var optId = radioName + '_' + option.id;
    var $optionElem = '<label for="' + optId + '">' + option.label + '</label>' +
                      '<input type="radio" name="' + radioName + '" id="' + optId + '" value="' + option.value + '" ' + getCheckedState(selectedValue == option.value) + '>';
    $radiosCont.find("fieldset").append($optionElem);
  }
  var $radios = $radiosCont.find("input[type=radio][name=" + radioName + "]")
  $radios.checkboxradio();
  $radiosCont.find("fieldset").controlgroup();
  $radios.change(function() { onChangeFn(this.value, this.id); });
  return $radiosCont;
}

function setVisibility(element, visible) {
  if (visible) { element.show(); } else { element.hide(); }
}
