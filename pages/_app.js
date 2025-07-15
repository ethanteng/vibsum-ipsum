import { useEffect } from "react";
import Head from "next/head";
import '@/styles/globals.css';

export default function MyApp({ Component, pageProps }) {
  /*
  useEffect(() => {
    // Only run this in the browser
    window.intercomSettings = { app_id: "ngrrdj4s" };

    (function () {
      var w = window;
      var ic = w.Intercom;
      if (typeof ic === "function") {
        ic('reattach_activator');
        ic('update', w.intercomSettings);
      } else {
        var d = document;
        var i = function () { i.c(arguments); };
        i.q = [];
        i.c = function (args) { i.q.push(args); };
        w.Intercom = i;
        function l() {
          var s = d.createElement('script');
          s.type = 'text/javascript';
          s.async = true;
          s.src = 'https://widget.intercom.io/widget/ngrrdj4s';
          var x = d.getElementsByTagName('script')[0];
          x.parentNode.insertBefore(s, x);
        }
        if (document.readyState === 'complete') {
          l();
        } else if (w.attachEvent) {
          w.attachEvent('onload', l);
        } else {
          w.addEventListener('load', l, false);
        }
      }
    })();
  }, []);
  */

  return <Component {...pageProps} />;
}