import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { useEntitlements } from "@/components/entitlements";
import { theme } from "@/components/ui";

type BannerProps = {
  unitId: string;
  size: string;
  requestOptions?: { requestNonPersonalizedAdsOnly?: boolean };
};

/**
 * Non-intrusive banner for free-tier users only.
 *
 * Uses react-native-google-mobile-ads when the native module and unit IDs are
 * present; otherwise renders nothing so Expo Go / unconfigured builds stay clean.
 */
export function AdsBanner() {
  const { isPremium, ready } = useEntitlements();
  const [Banner, setBanner] = useState<React.ComponentType<BannerProps> | null>(
    null,
  );
  const [size, setSize] = useState("ANCHORED_ADAPTIVE_BANNER");

  const unitId =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID;

  useEffect(() => {
    if (isPremium || !unitId) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ads = require("react-native-google-mobile-ads") as {
        BannerAd: React.ComponentType<BannerProps>;
        BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: string };
        default?: { initialize?: () => Promise<unknown> };
        MobileAds?: () => { initialize: () => Promise<unknown> };
      };
      const init =
        ads.MobileAds?.().initialize ?? ads.default?.initialize ?? null;
      init?.().catch(() => {});
      if (ads.BannerAdSize?.ANCHORED_ADAPTIVE_BANNER) {
        setSize(ads.BannerAdSize.ANCHORED_ADAPTIVE_BANNER);
      }
      setBanner(() => ads.BannerAd);
    } catch {
      setBanner(null);
    }
  }, [isPremium, unitId]);

  if (!ready || isPremium || !unitId || !Banner) {
    return null;
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Advertisement">
      <Banner
        unitId={unitId}
        size={size}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.semantic.canvas,
    paddingVertical: theme.space[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.semantic.border,
  },
});
