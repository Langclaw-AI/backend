import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Langclaw",
  description:
    "A verifiable multi-agent trend research chat for X-native teams.",
  icons: {
    icon: "/favicon.svg",
  },
};

const extensionHydrationCleanupScript = `
(function () {
  var attributeName = "bis_skin_checked";

  function clean(root) {
    if (!root || root.nodeType !== 1) {
      return;
    }

    if (root.hasAttribute && root.hasAttribute(attributeName)) {
      root.removeAttribute(attributeName);
    }

    if (!root.querySelectorAll) {
      return;
    }

    var nodes = root.querySelectorAll("[" + attributeName + "]");
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].removeAttribute(attributeName);
    }
  }

  clean(document.documentElement);

  if (!window.MutationObserver) {
    return;
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i += 1) {
      var mutation = mutations[i];

      if (mutation.type === "attributes") {
        clean(mutation.target);
      }

      for (var j = 0; j < mutation.addedNodes.length; j += 1) {
        clean(mutation.addedNodes[j]);
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [attributeName],
    childList: true,
    subtree: true
  });

  window.setTimeout(function () {
    observer.disconnect();
  }, 5000);
})();
`;

const walletFallbackScript = `
(function () {
  var walletConnectedEvent = "langclaw:wallet-connected";

  function shortAddress(address) {
    if (!address || address.length <= 12) {
      return address || "Connect Wallet";
    }

    return address.slice(0, 6) + "..." + address.slice(-4);
  }

  function getProvider() {
    var ethereum = window.ethereum;

    if (!ethereum) {
      return null;
    }

    if (Array.isArray(ethereum.providers) && ethereum.providers.length) {
      return (
        ethereum.providers.find(function (provider) { return provider.isMetaMask; }) ||
        ethereum.providers.find(function (provider) { return provider.isRabby; }) ||
        ethereum.providers.find(function (provider) { return provider.isOkxWallet; }) ||
        ethereum.providers[0]
      );
    }

    return ethereum;
  }

  function readAccounts(value) {
    return Array.isArray(value)
      ? value.filter(function (item) { return typeof item === "string"; })
      : [];
  }

  function withTimeout(request, timeoutMs, message) {
    var timeoutId;
    var timeout = new Promise(function (_, reject) {
      timeoutId = window.setTimeout(function () {
        reject(new Error(message));
      }, timeoutMs);
    });

    return Promise.race([request, timeout]).finally(function () {
      window.clearTimeout(timeoutId);
    });
  }

  function setError(message) {
    var error = document.getElementById("langclaw-wallet-error");

    if (!error) {
      return;
    }

    if (!message) {
      error.textContent = "";
      error.classList.add("hidden");
      return;
    }

    error.textContent = message;
    error.classList.remove("hidden");
  }

  function setButtonLabel(button, text) {
    var label = button.querySelector("[data-wallet-label]");
    if (label) {
      label.textContent = text;
    } else {
      button.textContent = text;
    }
  }

  function publishWallet(wallet) {
    window.dispatchEvent(new CustomEvent(walletConnectedEvent, { detail: wallet }));
  }

  async function connectWallet(button) {
    setError("");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    setButtonLabel(button, "Connecting...");

    var provider = getProvider();

    if (!provider) {
      setError("Wallet extension not found. Open this app in a browser with MetaMask, Rabby, or OKX Wallet.");
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      setButtonLabel(button, "Connect Wallet");
      return;
    }

    try {
      var existingAccounts = readAccounts(
        await withTimeout(
          provider.request({ method: "eth_accounts" }).catch(function () { return []; }),
          3000,
          "Unable to read connected wallet accounts."
        )
      );
      var accounts = existingAccounts.length
        ? existingAccounts
        : readAccounts(
            await withTimeout(
              provider.request({ method: "eth_requestAccounts" }),
              15000,
              "Wallet request timed out. Open your wallet extension and approve the connection."
            )
          );
      var address = accounts[0];

      if (!address) {
        throw new Error("No wallet account selected.");
      }

      var connectedAt = new Date().toISOString();
      var wallet = {
        address: address,
        connectedAt: connectedAt
      };

      publishWallet(wallet);
      setButtonLabel(button, shortAddress(address));

      try {
        var message = "Login to Langclaw\\nAddress: " + address + "\\nTime: " + new Date().toISOString();
        var signature = await withTimeout(
          provider.request({
            method: "personal_sign",
            params: [message, address]
          }),
          30000,
          "Signature request timed out. Open your wallet extension and approve the request."
        );

        wallet = {
          address: address,
          connectedAt: connectedAt,
          message: message,
          signature: signature
        };
        publishWallet(wallet);
        setError("");
      } catch {
        setError("Wallet connected. Sign message to continue.");
      }
    } catch (error) {
      setError(error && error.message ? error.message : "Wallet login failed.");
      setButtonLabel(button, "Connect Wallet");
    } finally {
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
    }
  }

  function bindWalletButton() {
    var button = document.getElementById("langclaw-connect-wallet-button");

    if (!button || button.__langclawWalletFallbackBound === true) {
      return;
    }

    button.__langclawWalletFallbackBound = true;

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      connectWallet(button);
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindWalletButton);
  } else {
    bindWalletButton();
  }

  window.addEventListener("pageshow", bindWalletButton);
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Script
          id="extension-hydration-cleanup"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: extensionHydrationCleanupScript }}
        />
        <script
          id="langclaw-wallet-fallback"
          dangerouslySetInnerHTML={{ __html: walletFallbackScript }}
        />
      </body>
    </html>
  );
}
