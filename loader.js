window._yri = window._yri || {};
if (!window._yri.initialized) {
  // polyfill String.prototype.startsWith()
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(search, pos) {
      return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
    };
  }

  (function(w, d, y) {
    if (!w.console) w.console = {};
    if (!w.console.log) w.console.log = function() {};
    if (!w.console.dir) w.console.dir = function() {};
    if (!w.console.groupCollapsed) w.console.groupCollapsed = function() {};
    if (!w.console.groupEnd) w.console.groupEnd = function() {};

    function getElementOrThrow(id) {
      var element = d.getElementById(id);
      if (!element) {
        throw new Error("Element not found: #" + id);
      }
      return element;
    }

    function getIframeUrl() {
      var endpoint = "/sessions/new/" + y.token + "?popup_mode=" + y.popup_mode;
      var url = y.config.baseUrl + endpoint;
      console.log("url: " + url);
      return url;
    }

    function convertStringToURL(string) {
      var addProtocol = function(str) {
        return str.startsWith("http") || str.startsWith("//")
          ? str
          : "//" + str;
      };

      var origin = function(anchorElement) {
        return (
          anchorElement.protocol +
          "//" +
          anchorElement.hostname +
          (anchorElement.port ? ":" + anchorElement.port : "")
        );
      };

      var l = d.createElement("a");
      l.href = addProtocol(string);
      return l.origin ? l.origin : origin(l);
    }

    function initAssetVerification(/*event*/) {
      y.popup_mode ? y.pop() : y.embed();
    }

    function receiveMessage(event) {
      try {
        console.groupCollapsed("receiveMessage");
        console.log(event);

        var origin = convertStringToURL(event.origin);
        if (origin === y.config.baseUrl) {
          y.do(event);
        } else {
          console.log("Message origin [" + origin + "] not accepted.");
          console.log("Expected origin [" + y.config.baseUrl + "]");
        }
      } finally {
        console.groupEnd();
      }
    }

    function getIframe() {
      if (!y._iframe) {
        y._iframe = getElementOrThrow(y.config.iframe_id);
      }
      return y._iframe;
    }

    function validate() {
      function ensureValidTokenOrThrow() {
        function parseJwt(jwt) {
          try {
            var payload = jwt.split(".")[1];
            var replaced = payload.replace("-", "+").replace("_", "/");
            var decoded = w.atob(replaced);
            return JSON.parse(decoded);
          } catch (e) {
            return null;
          }
        }

        function isValidJwt() {
          var parsed_token = parseJwt(y.token);
          return (
            parsed_token &&
            parsed_token.constructor === {}.constructor &&
            parsed_token.hasOwnProperty("public_id")
          );
        }

        if (y.token && isValidJwt()) {
          return;
        }

        throw new Error("Invalid consumer session token: " + y.token);
      }

      function ensureValidOrderOrThrow() {
        if (y.order && typeof y.order !== "object") {
          throw new Error("Invalid order: " + y.order);
        }
      }

      function ensureValidProductOrThrow() {
        if (!y.order.product) {
          return;
        }
        if (typeof y.order.product.code === "string") {
          y.order.product = y.order.product.code;
        }
        if (typeof y.order.product !== "string") {
          throw new Error("Invalid product: " + y.order.product);
        }
      }

      ensureValidTokenOrThrow();
      ensureValidOrderOrThrow();
      ensureValidProductOrThrow();
    }

    y.config = {
      container_id: "_yri_root",
      iframe_id: "_yri_iframe",
      baseUrl: (function() {
        if (!y.url) {
          throw new Error("Url for loader script must be present!");
        }
        return convertStringToURL(y.url);
      })()
    };

    y.messages = {
      source: null,
      origin: null
    };

    y.options = y.options || {};

    y.order = y.order || {};

    y.do = function(event) {
      function setIframeHeight(height) {
        if (y.popup_mode) return;

        var height_in_pixels = height + "px";
        if (height_in_pixels === getIframe().style.height) {
          console.log("same height, do not resize");
          return;
        }

        console.log("resizing iframe to: " + height_in_pixels);
        getIframe().style.height = height_in_pixels;
      }

      function update_order(new_order_details) {
        var old_order_details = y.order;
        y.order = new_order_details;
        if (old_order_details && old_order_details.applicant) {
          y.order.applicant = old_order_details.applicant;
        }
        if (old_order_details && old_order_details.co_applicants) {
          y.order.co_applicants = old_order_details.co_applicants;
        }

        console.log("ORDER:");
        console.log(JSON.stringify(y.order));
      }

      function close_popup() {
        if (!y.popup_reference) return;

        console.log("closing popup");
        y.popup_reference.close();
      }

      function remove_iframe() {
        var iframe = d.getElementById(y.config.iframe_id);
        if (!iframe) return;

        console.log("destroying iframe");
        iframe.parentNode.removeChild(iframe);
      }

      function ie11CustomEvent(typeArg, detail) {
        var event = d.createEvent("CustomEvent");
        event.initCustomEvent(typeArg, true, true, detail);
        return event;
      }

      function customEvent(typeArg, detail) {
        return new w.CustomEvent(typeArg, {
          detail: detail,
          bubbles: true,
          cancellable: false
        });
      }

      function dispatchEvent(typeArg, detail) {
        var eventType = typeArg + "_yri";
        var event =
          w.CustomEvent && typeof w.CustomEvent === "function"
            ? customEvent(eventType, detail)
            : ie11CustomEvent(eventType, detail);

        console.log("dispatchEvent: " + eventType);
        d.dispatchEvent(event);
      }

      function set_source_origin() {
        y.messages.source = event.source;
        y.messages.origin = event.origin;
      }

      var data = event.data;
      var detail = data.detail || {};

      switch (data.action) {
        case "heartbeat":
          console.log("Heartbeat received");
          set_source_origin();
          break;

        case "resize":
          if (detail && detail.height) {
            console.log("Resize => [" + detail.height + "]");
            setIframeHeight(detail.height);
          }
          break;

        case "message":
          console.log("Message => [" + data.typeArg + "]");

          if (detail) {
            if (detail.category) {
              console.log("Category => [" + detail.category + "]");

              if (detail.category === "new_institution") {
                y._postBackMessage(event, {
                  action: "options",
                  options: y.options || {}
                });
              }

              if (detail.category === "order_submission") {
                y._postBackMessage(event, {
                  action: "order_settings",
                  data: {
                    order_id: y.order_id,
                    order: y.order || {}
                  }
                });
              }

              if (detail && detail.category === "order_created") {
                update_order(detail.order);
              }
            }
            dispatchEvent(data.typeArg, detail);
          }

          break;

        case "finalize":
          console.log("Finalize => [" + data.typeArg + "]");
          y.popup_mode ? close_popup() : remove_iframe();
          y.popup_reference = null;
          y._iframe = null;

          set_source_origin();
          y._postBackMessage(event, { action: "close" });

          dispatchEvent(data.typeArg, detail);
          break;
      }
    };

    y.embed = function() {
      try {
        console.groupCollapsed("_yri.embed");

        var iframeExists = d.getElementById(y.config.iframe_id);
        if (iframeExists) {
          console.log("iframe already exist!");
          return;
        }
        validate();

        var container = (function() {
          y._container = getElementOrThrow(y.config.container_id);
          return y._container;
        })();
        window._yri.popup_mode = false;

        console.log("Appending iframe to container.");
        var iframe = (function() {
          var iframe = d.createElement("iframe");
          iframe.id = y.config.iframe_id;
          iframe.src = getIframeUrl();
          iframe.style.overflow = "hidden";
          iframe.frameBorder = "0";
          iframe.width = "100%";
          iframe.scrolling = "no";
          iframe.height = "800px";
          return iframe;
        })();
        container.appendChild(iframe);
      } finally {
        console.groupEnd();
      }
    };

    y.pop = function(width, height) {
      try {
        console.groupCollapsed("_yri.pop");

        if (y.popup_reference && !y.popup_reference.closed) {
          console.log("popup already exist!");
          y.popup_reference.focus();
          return;
        }
        validate();

        w._yri.popup_mode = true;

        var windowFeatures = function(width, height) {
          var default_window_size = 700;
          return (
            "location=0,titlebar=0,dependent,resizable,width=" +
            (width || default_window_size) +
            ",height=" +
            (height || default_window_size)
          );
        };

        y.popup_reference = w.open(
          getIframeUrl(),
          "_yri_asset_validation_popup",
          windowFeatures(width, height)
        );
      } finally {
        console.groupEnd();
      }
    };

    y.navigate = function(page) {
      try {
        console.groupCollapsed("_yri.navigate");

        if (page !== "accounts" && page !== "search" && page !== "skip") {
          console.error(page + " is an invalid page!");
          return;
        }

        y._postBackMessage(y.messages, {
          action: "navigate",
          page: page
        });
      } finally {
        console.groupEnd();
      }
    };

    y._postBackMessage = function(event, message) {
      if (event.source && event.origin) {
        console.log("Sending message to " + event.origin);
        event.source.postMessage(message, event.origin);
      }
    };

    w.addEventListener("init_yri", initAssetVerification, false);
    w.addEventListener("start_yri", initAssetVerification, false); // deprecated
    w.addEventListener("message", receiveMessage, false);

    y.initialized = true;
  })(window, window.document, window._yri, undefined);
} else {
  console.log("YRI already initialized!");
}
