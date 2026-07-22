import { TranslationCatalogueService } from "@/lib/translations/catalogue";
import { BrowserTranslationCatalogueStore } from "@/lib/translations/catalogueStore";
import { LocalStoragePassageCache } from "@/lib/translations/cache";
import { getRemoteTranslationConfig } from "@/lib/translations/config";
import { EmbeddedTranslationProvider, UnavailableInstalledPackProvider } from "@/lib/translations/provider";
import { RheloRemoteCatalogueClient } from "@/lib/translations/remoteCatalogue";
import { RheloRemoteTranslationProvider } from "@/lib/translations/remoteProvider";
import { UnifiedTranslationService } from "@/lib/translations/service";

let runtime: UnifiedTranslationService | null = null;

export function getTranslationService(): UnifiedTranslationService {
  if (runtime) return runtime;

  const config = getRemoteTranslationConfig();
  const catalogueStore = new BrowserTranslationCatalogueStore();
  const remoteCatalogue = new RheloRemoteCatalogueClient(config);
  const catalogue = new TranslationCatalogueService({
    listInstalled: async () => [],
    readCachedRemote: () => catalogueStore.read(),
    fetchLatestRemote: () => remoteCatalogue.fetchLatest(),
    writeCachedRemote: (translations) => catalogueStore.write(translations),
  });

  const embedded = new EmbeddedTranslationProvider();
  const installedPack = new UnavailableInstalledPackProvider();
  const remote = new RheloRemoteTranslationProvider(config, () => catalogue.getCatalogue());
  runtime = new UnifiedTranslationService(
    catalogue,
    {
      embedded,
      installed_pack: installedPack,
      rhelo_api: remote,
    },
    new LocalStoragePassageCache(),
  );
  return runtime;
}
