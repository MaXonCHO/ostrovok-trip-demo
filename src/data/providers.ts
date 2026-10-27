import { FixtureCatalogRepository } from "./adapters/catalog";
import { JsonFileTripRepository, AppError } from "./adapters/json-file";
import { MockAgentProvider } from "./adapters/agent";
import { DeepSeekAgentProvider } from "./adapters/deepseek-agent";
import { DeterministicRecommendationProvider } from "./adapters/recommendation";
import { FixtureGeoProvider } from "./adapters/geo";
export function providers() {
  for (const [name, value] of Object.entries({
    CATALOG_PROVIDER: "fixture",
    TRIP_STORE: "json",
    RECOMMENDATION_PROVIDER: "fixture",
    GEO_PROVIDER: "fixture",
  }))
    if (process.env[name] && process.env[name] !== value)
      throw new AppError(
        503,
        `Режим ${name}=${process.env[name]} пока не подключён. Настройте адаптер по docs/data-integration.md.`,
      );
  const mode =
    process.env.AGENT_PROVIDER ||
    (process.env.DEEPSEEK_API_KEY ? "deepseek" : "mock");
  if (mode !== "mock" && mode !== "deepseek")
    throw new AppError(
      503,
      "Неизвестный AGENT_PROVIDER. Используйте mock или deepseek.",
    );
  const catalog = new FixtureCatalogRepository();
  return {
    catalog,
    trips: new JsonFileTripRepository(),
    agent:
      mode === "deepseek"
        ? new DeepSeekAgentProvider()
        : new MockAgentProvider(),
    agentMode: mode as "mock" | "deepseek",
    recommendations: new DeterministicRecommendationProvider(catalog),
    geo: new FixtureGeoProvider(),
  };
}
