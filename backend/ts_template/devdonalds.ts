import express, { Request, Response } from "express";

// ==== Type Definitions, feel free to add or modify ==========================
interface cookbookEntry {
  name: string;
  type: string;
}

interface requiredItem {
  name: string;
  quantity: number;
}

interface recipe extends cookbookEntry {
  requiredItems: requiredItem[];
}

interface ingredient extends cookbookEntry {
  cookTime: number;
}

// =============================================================================
// ==== HTTP Endpoint Stubs ====================================================
// =============================================================================
const app = express();
app.use(express.json());

// In-memory store for cookbook entries (unique by name)
interface RequiredItem {
  name: string;
  quantity: number;
}

interface RecipeEntry {
  type: "recipe";
  name: string;
  requiredItems: RequiredItem[];
}

interface IngredientEntry {
  type: "ingredient";
  name: string;
  cookTime: number;
}

type CookbookEntry = RecipeEntry | IngredientEntry;

//Stores recipes
const cookbook: { [name: string]: CookbookEntry } = {};

// Task 1 helper (don't touch)
app.post("/parse", (req:Request, res:Response) => {
  const { input } = req.body;

  const parsed_string = parse_handwriting(input)
  if (parsed_string == null) {
    res.status(400).send("this string is cooked");
    return;
  } 
  res.json({ msg: parsed_string });
  return;
  
});

// [TASK 1] ====================================================================
// Takes in a recipeName and returns it in a form that 
const parse_handwriting = (recipeName: string): string | null => {
  if (!recipeName || recipeName.trim() === '') return null;

  const words = recipeName
    .replace(/[-_]+/g, ' ')
    .replace(/[^a-zA-Z ]+/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return null;

  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// [TASK 2] ====================================================================
// Endpoint that adds a CookbookEntry to your magical cookbook
app.post("/entry", (req: Request, res: Response) => {
  const data = req.body;

  // Validate required top-level fields
  if (!data?.name || typeof data.name !== "string" || !data?.type) {
    res.status(400).send();
    return;
  }

  const name: string = data.name;
  const entryType: string = data.type;

  // Enforce unique names
  if (cookbook[name]) {
    res.status(400).send();
    return;
  }

  // Validate entry type
  if (entryType !== "ingredient" && entryType !== "recipe") {
    res.status(400).send();
    return;
  }

  if (entryType === "ingredient") {
    // Ensure cookTime is a valid integer and >= 0
    if (typeof data.cookTime !== "number" || data.cookTime < 0 || !Number.isInteger(data.cookTime)) {
      res.status(400).send();
      return;
    }
    
    const ingredient: IngredientEntry = {
      type: "ingredient",
      name,
      cookTime: data.cookTime
    };
    cookbook[name] = ingredient;
    res.status(200).send();
    return;
  } else {
    // For a recipe, validate that requiredItems is a non-empty array
    if (!Array.isArray(data.requiredItems) || data.requiredItems.length === 0) {
      res.status(400).send();
      return;
    }
    
    const seen = new Set<string>();
    const requiredItems: RequiredItem[] = [];
    
    // Validate each required item
    for (const item of data.requiredItems) {
      if (
        !item?.name ||
        typeof item.name !== "string" ||
        typeof item.quantity !== "number" ||
        item.quantity <= 0 ||
        !Number.isInteger(item.quantity)
      ) {
        res.status(400).send();
        return;
      }
      
      if (seen.has(item.name)) {
        res.status(400).send();
        return;
      }
      
      seen.add(item.name);
      requiredItems.push({ name: item.name, quantity: item.quantity });
    }
    
    const recipe: RecipeEntry = {
      type: "recipe",
      name,
      requiredItems
    };
    cookbook[name] = recipe;
    res.status(200).send();
    return;
  }
});

// [TASK 3] ====================================================================
// Endpoint that returns a summary of a recipe that corresponds to a query name
app.get("/summary", (req: Request, res: Response) => {
  // Validate that query parameter "name" is provided as a string.
  const recipeName = req.query.name;
  if (!recipeName || typeof recipeName !== "string") {
    res.status(400).send();
    return;
  }

  const entry = cookbook[recipeName];

  if (!entry || entry.type !== "recipe") {
    res.status(400).send();
    return;
  }

  function getBaseIngredients(name: string, multiplier: number): Map<string, number> | null {
    const entry = cookbook[name];
    if (!entry) return null;
    
   
    if (entry.type === "ingredient") {
      return new Map([[name, multiplier]]);
    }
    if (entry.type === "recipe") {
      const baseMap = new Map<string, number>();
      for (const item of entry.requiredItems) {
        const child = cookbook[item.name];
        if (!child) return null;
        
        if (child.type === "ingredient") {
          const current = baseMap.get(child.name) || 0;
          baseMap.set(child.name, current + item.quantity * multiplier);
        } else if (child.type === "recipe") {
          const subMap = getBaseIngredients(child.name, item.quantity * multiplier);
          if (!subMap) return null;
          for (const [ingName, qty] of subMap.entries()) {
            const current = baseMap.get(ingName) || 0;
            baseMap.set(ingName, current + qty);
          }
        }
      }
      return baseMap;
    }
    return null;
  }

  const baseIngredients = getBaseIngredients(recipeName, 1);
  if (!baseIngredients) {
    res.status(400).send();
    return;
  }

  let totalCookTime = 0;
  const ingredientsArr: { name: string; quantity: number }[] = [];

  for (const [ingName, qty] of baseIngredients.entries()) {
    const ingredient = cookbook[ingName];
    if (!ingredient || ingredient.type !== "ingredient") {
      res.status(400).send();
      return;
    }
    totalCookTime += qty * ingredient.cookTime;
    ingredientsArr.push({ name: ingName, quantity: qty });
  }

  const summary = {
    name: recipeName,
    cookTime: totalCookTime,
    ingredients: ingredientsArr,
  };

  res.status(200).json(summary);
  return;
});

// =============================================================================
// ==== DO NOT TOUCH ===========================================================
// =============================================================================
const port = 8080;
app.listen(port, () => {
  console.log(`Running on: http://127.0.0.1:8080`);
});
