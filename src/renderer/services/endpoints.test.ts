import { afterEach, expect, test, vi } from 'vitest';

import { configService } from './config';
import {
  getClientBannerTargetUrl,
  getEnterpriseBillingUrl,
  getEnterpriseMemberProfileUrl,
  getEnterpriseOverviewUrl,
  getEnterpriseRechargeUrl,
  getEnterpriseUsageUrl,
  getPortalCreditsDetailUrl,
  getPortalCreditsResetActivityUrl,
  getPortalInvitationUrl,
  getPortalPricingUrl,
  getPortalProfileUrl,
  getPortalRechargeUrl,
  getPortalSubscriptionTrialUrl,
  PortalPricingKeyfrom,
} from './endpoints';

const mockTestMode = (testMode: boolean) => {
  vi.spyOn(configService, 'getConfig').mockReturnValue({
    app: { testMode },
  } as ReturnType<typeof configService.getConfig>);
};

afterEach(() => {
  vi.restoreAllMocks();
});

test('portal account urls use production base when test mode is disabled', () => {
  mockTestMode(false);

  expect(getPortalProfileUrl()).toBe('http://127.0.0.1:8765');
  expect(getPortalCreditsDetailUrl()).toBe('http://127.0.0.1:8765');
  expect(getPortalRechargeUrl()).toBe('http://127.0.0.1:8765');
  expect(getPortalInvitationUrl()).toBe('http://127.0.0.1:8765');
  expect(getPortalCreditsResetActivityUrl()).toBe('http://127.0.0.1:8765');
  expect(getPortalCreditsResetActivityUrl('credits_final_reward_2026_07')).toBe(
    'http://127.0.0.1:8765',
  );
});

test('portal account urls use test base when test mode is enabled', () => {
  mockTestMode(true);

  expect(getPortalProfileUrl()).toBe('http://127.0.0.1:8765');
  expect(getPortalCreditsDetailUrl()).toBe('http://127.0.0.1:8765');
  expect(getPortalRechargeUrl()).toBe('http://127.0.0.1:8765');
  expect(getPortalInvitationUrl()).toBe('http://127.0.0.1:8765');
  expect(getPortalCreditsResetActivityUrl()).toBe('http://127.0.0.1:8765');
});

test('portal pricing url can include html share keyfrom', () => {
  mockTestMode(false);

  expect(getPortalPricingUrl(PortalPricingKeyfrom.HtmlShare)).toBe(
    'http://127.0.0.1:8765',
  );
});

test('portal pricing url can carry a publishing attribution trace', () => {
  mockTestMode(false);

  expect(getPortalPricingUrl(
    PortalPricingKeyfrom.SiteDeployment,
    { traceId: 'attempt-123' },
  )).toBe(
    'http://127.0.0.1:8765',
  );
});

test('enterprise console urls use the selected enterprise context', () => {
  mockTestMode(false);

  expect(getEnterpriseMemberProfileUrl(1001)).toBe(
    'http://127.0.0.1:8765',
  );
  expect(getEnterpriseOverviewUrl(1001)).toBe(
    'http://127.0.0.1:8765',
  );
  expect(getEnterpriseUsageUrl(1001)).toBe(
    'http://127.0.0.1:8765',
  );
  expect(getEnterpriseBillingUrl(1001)).toBe(
    'http://127.0.0.1:8765',
  );
  expect(getEnterpriseRechargeUrl(1001)).toBe(
    'http://127.0.0.1:8765',
  );
});


test('trial popup targets the penny slide and opens checkout in both environments', () => {
  for (const testMode of [false, true]) {
    mockTestMode(testMode);
    const url = new URL(getPortalSubscriptionTrialUrl('trial/2026', { checkout: true }));
    expect(url.hostname).toBe(testMode ? 'lobsterai.inner.mkai.tech' : 'mkai.tech');
    const route = new URL(url.hash.slice(1), url.origin);
    expect(route.searchParams.get('banner')).toBe('penny');
    expect(route.searchParams.get('trialCampaign')).toBe('trial/2026');
    expect(route.searchParams.get('trialCheckout')).toBe('1');
    expect(getPortalSubscriptionTrialUrl('trial/2026')).not.toContain('trialCheckout');
    expect(route.searchParams.get('tab')).toBe('subscription');
  }
});

test('penny sidebar links retain attribution and select the subscription banner', () => {
  expect(getClientBannerTargetUrl(
    'http://127.0.0.1:8765',
    '  ¥0.01   1000  ',
  )).toBe('http://127.0.0.1:8765');
  expect(getClientBannerTargetUrl(
    'http://127.0.0.1:8765',
    ' ',
  )).toBe('http://127.0.0.1:8765');
});

test('unrelated banners keep their configured destinations', () => {
  for (const url of [
    'http://127.0.0.1:8765',
    'https://example.com/?trialCampaign=fall',
    'http://127.0.0.1:8765',
  ]) expect(getClientBannerTargetUrl(url, ' ')).toBe(url);
});
