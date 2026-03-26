import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, perfil, ...campos } = body;

  if (!id || !perfil) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  // Build the data object
  const data: Record<string, string | null> = {
    numero_de_telefono: id,
    perfil,
  };

  if (campos.contrasena) {
    data.contrasena = campos.contrasena;
  }

  if (perfil === "Estudiante") {
    if (!campos.estudiante_id) {
      return NextResponse.json({ error: "Falta el id estudiantil" }, { status: 400 });
    }
    data.estudiante_id = campos.estudiante_id;
  } else if (perfil === "Padre de familia") {
    if (!campos.padre_nombre) {
      return NextResponse.json({ error: "Faltan datos del padre" }, { status: 400 });
    }
    data.padre_nombre = campos.padre_nombre;
    if (campos.padre_id) {
      data.padre_id = campos.padre_id;
    }
    if (campos.padre_numero_de_estudiantes) {
      data.padre_numero_de_estudiantes = campos.padre_numero_de_estudiantes;
    }

    const numMap: Record<string, number> = { "1 (uno)": 1, "2 (dos)": 2, "3 (tres)": 3 };
    const num = numMap[campos.padre_numero_de_estudiantes] || 0;

    for (let i = 1; i <= num; i++) {
      const idKey = `padre_estudiante${i}_id`;
      if (campos[idKey]) {
        data[idKey] = campos[idKey];
      }
    }
  }

  // Check for duplicate codes
  const allCodes: string[] = [];
  if (data.estudiante_id) allCodes.push(data.estudiante_id);
  for (let i = 1; i <= 3; i++) {
    const key = `padre_estudiante${i}_id`;
    if (data[key]) allCodes.push(data[key]!);
  }

  // Validate all codes exist in Estudiantes
  for (const code of allCodes) {
    const { data: est } = await supabase
      .from("Estudiantes")
      .select("id_estudiantil")
      .eq("id_estudiantil", code)
      .single();

    if (!est) {
      return NextResponse.json({ error: `Documento ${code} no encontrado` }, { status: 400 });
    }
  }

  // Check if already exists in Perfiles_Generales
  const { data: existing } = await supabase
    .from("Perfiles_Generales")
    .select("numero_de_telefono")
    .eq("numero_de_telefono", id)
    .maybeSingle();

  let error;

  if (existing) {
    // Update existing row
    const result = await supabase
      .from("Perfiles_Generales")
      .update(data)
      .eq("numero_de_telefono", id);
    error = result.error;
  } else {
    // Insert new row
    const result = await supabase
      .from("Perfiles_Generales")
      .insert(data);
    error = result.error;
  }

  if (error) {
    console.error("Supabase error:", error);
    return NextResponse.json({ error: "Error al guardar el perfil: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
