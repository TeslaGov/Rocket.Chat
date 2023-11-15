
(function sso() {
  const loginTokenKey = "Meteor.loginToken";
  const loginTokenExpiresKey = "Meteor.loginTokenExpires";
  const userIdKey = "Meteor.userId";
  const hasLoginToken = localStorage.getItem(loginTokenKey) != null;
  const hasUserId = localStorage.getItem(userIdKey) != null;
  const expires = localStorage.getItem(loginTokenExpiresKey);
  const hasValidExpiration = expires != null && new Date(expires).getTime() > new Date().getTime();

  if (!hasLoginToken || !hasUserId || !hasValidExpiration) {
    const ssoEndpoint = RegExp(/https?:\/\/(.+\.)?ckm.test[:/]/).exec(window.location.href)
      ? window.location.href.replace(/^(https?:\/\/).+$/, "$1ckm.test/api/goddard/auth/sso")
      : window.location.href.replace(/^(https?:\/\/)([^/]+).+$/, "$1www-api.$2/goddard/auth/sso");

    console.log("Attempting RC SSO via Goddard...", ssoEndpoint);

    fetch(ssoEndpoint, { credentials: "include" })
      .then(r => r.json())
      .then(({ data: { authToken, userId } }) => {
        localStorage.setItem(loginTokenKey, authToken);
        localStorage.setItem(userIdKey, userId);
      })
      .catch(err => {
        console.log("Error while executing SSO.", err);
      });
  }
})();

import '../ee/definition';
import '../ee/client/ecdh';
import './polyfills';

import '../lib/oauthRedirectUriClient';
import './lib/meteorCallWrapper';
import './importPackages';

import '../ee/client';
import './methods';
import './startup';
import './views/admin';
import './views/marketplace';
import './views/account';
import './views/teams';
import './views/outlookCalendar';
