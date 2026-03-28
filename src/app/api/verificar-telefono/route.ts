import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "Falta el parámetro phone" }, { status: 400 });
  }

  // Strip country code (57) if present
  const phoneLocal = phone.startsWith("57") ? phone.slice(2) : phone;

  // 1. Check if already registered in Perfiles_Generales
  const { data: perfil } = await supabase
    .from("Perfiles_Generales")
    .select("perfil, contrasena, estudiante_id, padre_id")
    .eq("numero_de_telefono", phone)
    .maybeSingle();

  if (perfil && perfil.contrasena) {
    return NextResponse.json({ yaRegistrado: true });
  }

  // Also check with local phone (without 57)
  if (!perfil) {
    const { data: perfilLocal } = await supabase
      .from("Perfiles_Generales")
      .select("perfil, contrasena")
      .eq("numero_de_telefono", phoneLocal)
      .maybeSingle();

    if (perfilLocal && perfilLocal.contrasena) {
      return NextResponse.json({ yaRegistrado: true });
    }
  }

  // 2. Check if phone exists in Estudiantes.telefono_acudiente
  const { data: estudiantes } = await supabase
    .from("Estudiantes")
    .select("id_estudiantil, nombre_estudiante, apellidos_estudiante, nivel_estudiante, grado_estudiante, salon_estudiante, nombre_acudiente, telefono_acudiente")
    .contains("telefono_acudiente", [phoneLocal]);

  if (estudiantes && estudiantes.length > 0) {
    // It's a parent - get acudiente name from first match
    const nombreAcudiente = estudiantes[0].nombre_acudiente || "";
    const gradoOrden: Record<string, number> = {
      "Párvulo": 0, "Pre-Jardín": 1, "Jardín": 2, "Transición": 3,
      "Primero": 4, "Segundo": 5, "Tercero": 6, "Cuarto": 7, "Quinto": 8,
      "Sexto": 9, "Séptimo": 10, "Octavo": 11, "Noveno": 12,
      "Décimo": 13, "Undécimo": 14,
    };
    const hijos = estudiantes.map((e: any) => ({
      id: String(e.id_estudiantil),
      nombre: e.nombre_estudiante,
      apellidos: e.apellidos_estudiante,
      nivel: e.nivel_estudiante,
      grado: e.grado_estudiante,
      salon: e.salon_estudiante,
    })).sort((a: any, b: any) => {
      const ga = gradoOrden[a.grado] ?? 99;
      const gb = gradoOrden[b.grado] ?? 99;
      if (ga !== gb) return ga - gb;
      return (a.salon || "").localeCompare(b.salon || "");
    });

    return NextResponse.json({
      yaRegistrado: false,
      esPadre: true,
      nombreAcudiente,
      estudiantes: hijos,
    });
  }

  // 3. Not a parent - assume student
  return NextResponse.json({
    yaRegistrado: false,
    esPadre: false,
  });
}
