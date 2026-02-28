// components/CronScheduler.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Play,
  AlertCircle,
  Check,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { scheduleCron, parseApiError } from "@/lib/api";

interface CronSchedulerProps {
  user: string;
  onScheduled?: () => void;
}

type TimeUnit = "minutes" | "hours" | "days" | "weeks" | "months";

interface CronConfig {
  unit: TimeUnit;
  value: number;
}

// Generate cron expression from config
function generateCronExpression(config: CronConfig): string {
  const { unit, value } = config;

  switch (unit) {
    case "minutes":
      return `*/${value} * * * *`;
    case "hours":
      return `0 */${value} * * *`;
    case "days":
      return `0 0 */${value} * *`;
    case "weeks":
      return `0 0 * * ${value}`; // Run on specific day of week
    case "months":
      return `0 0 1 */${value} *`;
    default:
      return "0 * * * *"; // Default: every hour
  }
}

// Validate cron expression format
function validateCronExpression(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const patterns = [
    /^(\*|(\*\/)?[0-9]+|[0-9]+(,[0-9]+)*)$/, // minute (0-59)
    /^(\*|(\*\/)?[0-9]+|[0-9]+(,[0-9]+)*)$/, // hour (0-23)
    /^(\*|(\*\/)?[0-9]+|[0-9]+(,[0-9]+)*)$/, // day of month (1-31)
    /^(\*|(\*\/)?[0-9]+|[0-9]+(,[0-9]+)*)$/, // month (1-12)
    /^(\*|[0-9]+(,[0-9]+)*|[0-9]+-[0-9]+)$/, // day of week (0-6)
  ];

  return parts.every((part, i) => patterns[i].test(part));
}

// Parse URL and extract hostname
function extractHostname(url: string): string {
  try {
    let processedUrl = url.trim();
    if (!processedUrl.startsWith("http://") && !processedUrl.startsWith("https://")) {
      processedUrl = `https://${processedUrl}`;
    }
    const urlObj = new URL(processedUrl);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

// Validate URL
function isValidUrl(url: string): boolean {
  try {
    let processedUrl = url.trim();
    if (!processedUrl.startsWith("http://") && !processedUrl.startsWith("https://")) {
      processedUrl = `https://${processedUrl}`;
    }
    new URL(processedUrl);
    return true;
  } catch {
    return false;
  }
}

const TIME_UNITS: { value: TimeUnit; label: string }[] = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
];

const VALUE_OPTIONS: Record<TimeUnit, number[]> = {
  minutes: [1, 5, 10, 15, 30],
  hours: [1, 2, 4, 6, 12],
  days: [1, 2, 3, 7],
  weeks: [0, 1, 2, 3, 4, 5, 6], // Day of week (0 = Sunday)
  months: [1, 2, 3, 6],
};

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function CronScheduler({ user, onScheduled }: CronSchedulerProps) {
  const [url, setUrl] = useState("");
  const [cronConfig, setCronConfig] = useState<CronConfig>({
    unit: "hours",
    value: 1,
  });
  const [customCron, setCustomCron] = useState("");
  const [useCustomCron, setUseCustomCron] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Memoize cron expression
  const cronExpression = useMemo(() => {
    if (useCustomCron) return customCron;
    return generateCronExpression(cronConfig);
  }, [useCustomCron, customCron, cronConfig]);

  // Validation
  const urlError = useMemo(() => {
    if (!url) return null;
    if (!isValidUrl(url)) return "Please enter a valid URL";
    return null;
  }, [url]);

  const cronError = useMemo(() => {
    if (useCustomCron && customCron && !validateCronExpression(customCron)) {
      return "Invalid cron expression format";
    }
    return null;
  }, [useCustomCron, customCron]);

  const canSubmit = url && !urlError && !cronError && cronExpression;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const site = extractHostname(url);
      await scheduleCron({
        site,
        cron: cronExpression,
        range: "full", // TODO: Make configurable if needed
        user,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onScheduled?.();
      }, 2000);

      // Reset form
      setUrl("");
      setCronConfig({ unit: "hours", value: 1 });
      setCustomCron("");
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, url, cronExpression, user, onScheduled]);

  const getValueLabel = (unit: TimeUnit, value: number): string => {
    if (unit === "weeks") {
      return WEEK_DAYS[value];
    }
    return String(value);
  };

  const getScheduleDescription = (): string => {
    const { unit, value } = cronConfig;
    if (useCustomCron) return `Custom: ${customCron}`;

    switch (unit) {
      case "minutes":
        return `Every ${value} minute${value > 1 ? "s" : ""}`;
      case "hours":
        return `Every ${value} hour${value > 1 ? "s" : ""}`;
      case "days":
        return `Every ${value} day${value > 1 ? "s" : ""} at midnight`;
      case "weeks":
        return `Every ${WEEK_DAYS[value]} at midnight`;
      case "months":
        return `Every ${value} month${value > 1 ? "s" : ""} on the 1st`;
      default:
        return "";
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* URL Input & Preview */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-primary" />
            Website URL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Enter the URL to capture</Label>
            <div className="relative">
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={`pr-10 ${urlError ? "border-destructive" : ""}`}
              />
              {url && !urlError && (
                <a
                  href={url.startsWith("http") ? url : `https://${url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                  aria-label="Open URL in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            {urlError && (
              <p className="text-xs text-destructive">{urlError}</p>
            )}
          </div>

          {/* Live Preview */}
          {url && !urlError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-lg border border-border bg-muted/30"
            >
              <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">Preview</span>
                <span className="text-xs font-mono text-muted-foreground">
                  {extractHostname(url)}
                </span>
              </div>
              <div className="aspect-video">
                <iframe
                  src={url.startsWith("http") ? url : `https://${url}`}
                  className="h-full w-full"
                  title="Website preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Cron Configuration */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Schedule Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Unit/Value Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Capture every</Label>
              <Button
                variant={useCustomCron ? "outline" : "secondary"}
                size="sm"
                onClick={() => setUseCustomCron(false)}
                className="text-xs"
              >
                Simple
              </Button>
              <Button
                variant={useCustomCron ? "secondary" : "outline"}
                size="sm"
                onClick={() => setUseCustomCron(true)}
                className="text-xs"
              >
                Custom
              </Button>
            </div>

            <AnimatePresence mode="wait">
              {!useCustomCron ? (
                <motion.div
                  key="simple"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="value">Value</Label>
                    <Select
                      value={String(cronConfig.value)}
                      onValueChange={(v) =>
                        setCronConfig((prev) => ({ ...prev, value: Number(v) }))
                      }
                    >
                      <SelectTrigger id="value">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VALUE_OPTIONS[cronConfig.unit].map((val) => (
                          <SelectItem key={val} value={String(val)}>
                            {getValueLabel(cronConfig.unit, val)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={cronConfig.unit}
                      onValueChange={(v) =>
                        setCronConfig((prev) => ({
                          ...prev,
                          unit: v as TimeUnit,
                          value: VALUE_OPTIONS[v as TimeUnit][0],
                        }))
                      }
                    >
                      <SelectTrigger id="unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_UNITS.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="custom"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2"
                >
                  <Label htmlFor="custom-cron">Cron Expression</Label>
                  <Input
                    id="custom-cron"
                    placeholder="* * * * *"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    className={`font-mono ${cronError ? "border-destructive" : ""}`}
                  />
                  {cronError && (
                    <p className="text-xs text-destructive">{cronError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Format: minute hour day-of-month month day-of-week
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Schedule Preview */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Schedule:</span>
              <span className="text-sm font-medium">{getScheduleDescription()}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cron:</span>
              <code className="text-sm font-mono text-primary">{cronExpression}</code>
            </div>
          </div>

          {/* Error/Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Alert className="border-primary/50 bg-primary/10">
                  <Check className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary">
                    Cron job scheduled successfully!
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <Button
            className="w-full gap-2"
            disabled={!canSubmit || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isSubmitting ? "Scheduling..." : "Schedule Capture"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
