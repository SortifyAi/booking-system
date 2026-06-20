// @ts-nocheck
/**
 * GET /api/locations - Get all locations
 * POST /api/locations - Create a new location
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/server/db";
import type { Database } from "@/lib/types/database.types";
import { mockLocations } from "@/lib/mock-data";
import { isMockMode } from "@/lib/mock-mode";

/**
 * GET: Retrieve all locations (with optional filtering)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("organization_id");
    
    // Return mock data in mock mode
    if (isMockMode()) {
      let data = mockLocations;
      if (orgId) {
        data = mockLocations.filter(loc => loc.organization_id === orgId);
      }
      return NextResponse.json({ data, count: data.length });
    }
    
    const supabase = getSupabaseAdmin();
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase.from("locations").select("*");

    // Filter by organization if provided
    if (orgId) {
      query = query.eq("organization_id", orgId);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data,
      count,
      limit,
      offset,
      hasMore: count ? offset + limit < count : false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new location
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { organization_id, name, address, phone, timezone } = body;

    if (!organization_id || !name) {
      return NextResponse.json(
        { error: "Missing required fields: organization_id, name" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("locations")
      .insert({
        organization_id,
        name,
        address,
        phone: typeof phone === 'string' ? phone.trim() || null : null,
        timezone: timezone || "Europe/Berlin",
      } as Database["public"]["Tables"]["locations"]["Insert"])
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
