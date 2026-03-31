// Temporary test function to verify SideDrawer API credentials
Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SD_BASE_URL = Deno.env.get("SIDEDRAWER_BASE_URL") || "https://api-sbx.sidedrawersbx.com";
    const SD_CLIENT_ID = Deno.env.get("SIDEDRAWER_CLIENT_ID");
    const SD_CLIENT_SECRET = Deno.env.get("SIDEDRAWER_CLIENT_SECRET");
    const SD_TENANT_ID = Deno.env.get("SIDEDRAWER_TENANT_ID");

    const info = {
      baseUrl: SD_BASE_URL,
      hasClientId: !!SD_CLIENT_ID,
      hasClientSecret: !!SD_CLIENT_SECRET,
      hasTenantId: !!SD_TENANT_ID,
      tenantIdLength: SD_TENANT_ID?.length,
    };

    // Try multiple gateway URL patterns
    const gatewayUrls = [
      "https://tenants-gateway-api-sbx.sidedrawersbx.com",
      "https://tenants-gateway-prosperwisesbx.sidedrawersbx.com",
      "https://prosperwisesbx.sidedrawersbx.com",
      `${SD_BASE_URL.replace(/\/$/, "")}`,
    ];

    const results: any[] = [];
    for (const gw of gatewayUrls) {
      const tokenUrl = `${gw}/api/v1/developers/tenant/tenant-id/${SD_TENANT_ID}/applications/client-id/${SD_CLIENT_ID}/developer-login`;
      try {
        const res = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "ProsperWise/1.0" },
          body: JSON.stringify({ clientSecret: SD_CLIENT_SECRET }),
        });
        const body = await res.text();
        results.push({ gateway: gw, status: res.status, body: body.substring(0, 300) });
        if (res.status === 200 || res.status === 201) break;
      } catch (e) {
        results.push({ gateway: gw, error: e.message });
      }
    }

    return new Response(JSON.stringify({ ...info, results }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const tokenStatus = tokenRes.status;
    const tokenBody = await tokenRes.text();

    if (tokenStatus !== 200) {
      return new Response(JSON.stringify({ ...info, gatewayUrl, tokenUrl, tokenStatus, tokenError: tokenBody.substring(0, 500) }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = JSON.parse(tokenBody);
    const accessToken = tokenData.access_token || tokenData.token || tokenData.accessToken;

    // Test: get Doreen's drawer
    const sdId = "69c43763af140c3eaae49322";
    const recordRes = await fetch(`${SD_BASE_URL}/api/v1/records/sidedrawer/sidedrawer-id/${sdId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });

    const recordStatus = recordRes.status;
    const recordBody = await recordRes.text();

    // Test: list folders
    const foldersRes = await fetch(`${SD_BASE_URL}/api/v1/records/sidedrawer/sidedrawer-id/${sdId}/records`, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });
    const foldersStatus = foldersRes.status;
    const foldersBody = await foldersRes.text();

    return new Response(JSON.stringify({
      ...info,
      gatewayUrl,
      tokenStatus,
      hasToken: !!accessToken,
      tokenKeys: Object.keys(tokenData),
      recordStatus,
      record: recordBody.substring(0, 500),
      foldersStatus,
      folders: foldersBody.substring(0, 2000),
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
